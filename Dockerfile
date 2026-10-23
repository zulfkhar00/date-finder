FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Observability (all optional; see DEPLOYMENT.md). NEXT_PUBLIC_* values are public and are inlined
# into the browser bundle, so they must be build arguments. SENTRY_AUTH_TOKEN is a secret and is
# read from an optional BuildKit secret, never a build argument; without it source maps are not
# uploaded and the build still succeeds.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=""
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ARG GIT_SHA=""
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN 2>/dev/null || true)" npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ARG GIT_SHA=""
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    GIT_SHA=$GIT_SHA
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
