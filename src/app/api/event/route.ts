import { NextResponse } from "next/server";
import { clientEventSchema } from "@/lib/attribution";
import { CHECKOUT_CLIENT_EVENTS, clientDedupeKey, type CheckoutClientEvent } from "@/lib/checkout-events";
import { insertClientFunnelEvent } from "@/lib/funnel";
import { isNonProductionOrigin } from "@/lib/internal-traffic";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { FIRST_TOUCH_COOKIE, FIRST_TOUCH_MAX_AGE, firstTouchFromTraffic, serializeFirstTouch, shouldSetFirstTouch, trafficFromRequest } from "@/lib/traffic";

export const runtime = "nodejs";

// Small in-memory limiter per client address. One app instance serves the site, so this is
// enough to stop a single client from flooding funnel_events; it is not a security boundary.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const MAX_TRACKED_CLIENTS = 5_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, now: number): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= MAX_TRACKED_CLIENTS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size >= MAX_TRACKED_CLIENTS) hits.clear();
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// Only the CLIENT_EVENTS (page_view, get_started, reserve_start, onboarding_complete, checkout_canceled, checkout_form_ready, payment_submit, ...) are accepted from the browser.
// checkout_created, paid and the stripe_* events are recorded server-side by /api/checkout and the Stripe webhook.
// country and device are always derived here from the request headers (Vercel/Cloudflare geo header, User-Agent); the browser cannot set them.
export async function POST(request: Request) {
  if (rateLimited(clientKey(request), Date.now())) {
    return new NextResponse(null, { status: 429, headers: { "Retry-After": "60" } });
  }

  // Localhost and preview deployments never count: drop at the source instead of filtering later.
  if (isNonProductionOrigin(request.headers.get("origin"), process.env.SITE_URL ? new URL(process.env.SITE_URL).hostname : undefined)) {
    return new NextResponse(null, { status: 204 });
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 4096) return new NextResponse(null, { status: 413 });
    payload = JSON.parse(body);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = clientEventSchema.safeParse(payload);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  // Reduced here and nowhere else: the UA and geo headers are read, then dropped.
  const selfHost = process.env.SITE_URL ? new URL(process.env.SITE_URL).hostname : undefined;
  const traffic = trafficFromRequest(parsed.data, request.headers, selfHost);

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Checkout diagnostics carry the Checkout Session id and are idempotent per session per step, so a
  // double fire, a beacon plus its fetch fallback, or a spammed client records once.
  const isCheckoutEvent = (CHECKOUT_CLIENT_EVENTS as readonly string[]).includes(parsed.data.event);
  const checkoutId = parsed.data.checkoutId;
  const result = await insertClientFunnelEvent(supabase, {
    event: parsed.data.event,
    ...(isCheckoutEvent && checkoutId ? { dedupeKey: clientDedupeKey(parsed.data.event as CheckoutClientEvent, checkoutId, parsed.data.detail), detail: parsed.data.detail } : {}),
    sessionId: parsed.data.sessionId,
    variant: parsed.data.variant,
    utmCampaign: parsed.data.utmCampaign,
    ref: parsed.data.ref,
    traffic
  });
  // A rejected insert used to look identical to success, which hid a missing migration for days.
  if (!result.ok) return new NextResponse(null, { status: 503, headers: { "X-Funnel-Error": result.code } });
  const response = new NextResponse(null, { status: 204 });
  // First touch: remembered once, on the first real page_view, in a first-party cookie for 90 days. An existing
  // cookie is never overwritten (the later visit is the "last touch", which the funnel rows already carry).
  // Not set for crawlers, our own probe sessions, or when the browser sends Do-Not-Track / Global Privacy Control.
  if (shouldSetFirstTouch({ event: parsed.data.event, sessionId: parsed.data.sessionId, device: traffic.device, cookieHeader: request.headers.get("cookie"), headers: request.headers })) {
    response.cookies.set(FIRST_TOUCH_COOKIE, serializeFirstTouch(firstTouchFromTraffic(traffic, parsed.data.utmCampaign)), {
      maxAge: FIRST_TOUCH_MAX_AGE, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production"
    });
  }
  return response;
}
