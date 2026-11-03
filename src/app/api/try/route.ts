import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { draft } from "@/lib/concierge/draft";
import { recordFunnelEvent } from "@/lib/funnel";
import { isNonProductionOrigin } from "@/lib/internal-traffic";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { handleTryRequest } from "@/lib/try/handler";
import { getRunStore } from "@/lib/try/store";

export const runtime = "nodejs";
export const maxDuration = 60;

function reportError(label: string, status?: number) {
  // Only a label and a status code: never the request, the images or the model's output.
  console.error("Try tool error", label, status ?? "");
  Sentry.captureException(new Error(`${label}${status ? ` (${status})` : ""}`), { tags: { area: "try" } });
}

function salt(): string {
  return process.env.TRY_HASH_SALT || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "noswipe-try-unsalted";
}

export async function POST(request: Request) {
  return handleTryRequest(request, {
    store: getRunStore(),
    draft: (input) => draft(input),
    salt: salt(),
    reportError,
    shouldRecord: (origin) => !isNonProductionOrigin(origin, process.env.SITE_URL ? new URL(process.env.SITE_URL).hostname : undefined),
    recordResult: ({ sessionId }) => {
      // after(): runs once the response is sent, and keeps the function alive until it finishes (serverless).
      after(async () => {
        try {
          await recordFunnelEvent(getSupabaseAdmin(), { event: "try_result", sessionId });
        } catch {
          // Funnel tracking must never affect the response.
        }
      });
    }
  });
}
