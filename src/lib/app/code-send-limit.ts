// Per-network limit on sign-in code sends. No Next or "server-only" imports, so the checks can drive it.
// Held in memory, per server instance: a cold start or deploy forgets it, and parallel instances count apart.
// It stops one address from mailing in a loop. It does not stop a sender that keeps changing addresses.
import { isIP } from "node:net";

/** Sends one network may make per window. Generous: a person with resends needs a handful, an office or carrier shares one address. */
export const SEND_LIMIT = 20;
export const SEND_WINDOW_MS = 60 * 60_000;
const MAX_TRACKED = 5_000;

/**
 * The visitor's address as the proxy in front of the app saw it. Only the LAST X-Forwarded-For entry is read:
 * Vercel (production) overwrites the header with the client address, and a single reverse proxy (DEPLOYMENT.md,
 * Dokploy) appends it. Anything further left is whatever the client typed. Other "client IP" headers are ignored
 * because nothing in front of the app is known to set them over a client's value. Adding a second proxy in front
 * (e.g. a CDN) would make the last entry that proxy, so revisit this then.
 */
export function trustedClientIp(headers: { get(name: string): string | null }): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",").pop() : headers.get("x-real-ip"))?.trim();
  return ip && isIP(ip) ? ip : null;
}

/** What gets counted: an IPv4 address, or the /64 of an IPv6 one (a single line usually holds a whole /64). */
export function networkKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  const [head, tail] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = tail === undefined ? left : [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return `${groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":")}/64`;
}

/** Fixed window per key. */
export function createSendLimiter(limit = SEND_LIMIT, windowMs = SEND_WINDOW_MS, maxTracked = MAX_TRACKED) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    /** Counts one send. Returns 0 when it may go out, otherwise the milliseconds left. A refused try is not counted. */
    take(key: string, now: number): number {
      const entry = windows.get(key);
      if (entry && entry.resetAt > now) {
        if (entry.count >= limit) return entry.resetAt - now;
        entry.count += 1;
        return 0;
      }
      windows.delete(key);
      if (windows.size >= maxTracked) {
        for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
        // Still full: forget the oldest window only, never everyone's.
        if (windows.size >= maxTracked) windows.delete(windows.keys().next().value as string);
      }
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return 0;
    }
  };
}

export function sendLimitMessage(waitMs: number, hasCode: boolean): string {
  const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
  const when = `about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return `Too many sign-in codes were requested from your network. Try again in ${when}${hasCode ? ", or enter the code we already sent" : ""}.`;
}
