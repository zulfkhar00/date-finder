// Retry safety for /api/checkout. A person who backs out of the payment screen, double-taps, or
// comes back later should land on the SAME open Stripe session, not get a second reservation row and
// a second session. Pure logic over injected dependencies so it is unit-tested without Stripe or Supabase.

/** Stripe keeps a Checkout Session open for 24 hours. Stop reusing a little earlier. */
export const REUSE_WINDOW_MS = 23 * 60 * 60 * 1000;

export type PendingReservation = { id: string; stripe_checkout_session_id: string | null; created_at: string };
export type SessionLike = { id: string; status?: string | null; payment_status?: string | null; url?: string | null; client_secret?: string | null };

export type ReuseDeps<S extends SessionLike, R> = {
  /** Pending reservations for the email, newest first. */
  findPending: (email: string, since: string) => Promise<PendingReservation[]>;
  retrieve: (sessionId: string) => Promise<S>;
  /** Marks a reservation whose Stripe session ended unpaid as expired. */
  markExpired: (reservationId: string) => Promise<void>;
  /** Builds the client response, throws when the session cannot serve this client (wrong mode, no secret). */
  respond: (session: S) => R;
  now?: () => number;
};

export type ReuseResult<R> =
  | { kind: "reuse"; reservationId: string; sessionId: string; response: R }
  | { kind: "paid" }
  | { kind: "new" };

export async function reuseOpenCheckout<S extends SessionLike, R>(deps: ReuseDeps<S, R>, email: string): Promise<ReuseResult<R>> {
  const now = deps.now ? deps.now() : Date.now();
  let candidates: PendingReservation[];
  try {
    candidates = await deps.findPending(email, new Date(now - REUSE_WINDOW_MS).toISOString());
  } catch {
    return { kind: "new" };
  }
  for (const candidate of candidates.slice(0, 5)) {
    if (!candidate.stripe_checkout_session_id) continue;
    let session: S;
    try {
      session = await deps.retrieve(candidate.stripe_checkout_session_id);
    } catch {
      continue; // Stripe unreachable for this one: do not expire it on a guess
    }
    if (session.status === "open") {
      try {
        return { kind: "reuse", reservationId: candidate.id, sessionId: session.id, response: deps.respond(session) };
      } catch {
        continue;
      }
    }
    if (session.status === "complete") {
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") return { kind: "paid" };
      continue;
    }
    if (session.status === "expired") await deps.markExpired(candidate.id).catch(() => undefined);
  }
  return { kind: "new" };
}
