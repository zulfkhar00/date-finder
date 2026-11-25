// What the app knows about a match beyond name and age: bio, the app's own prompts, photos, distance. Stored as jsonb on matches.profile
// (supabase/2026-11-24-match-profiles.sql); null for matches that have none, and then the app shows no profile page. No "server-only" import:
// scripts check it directly and the UI formats with it.
import type { App } from "@/lib/app/domain";

export type MatchPrompt = { q: string; a: string };
export type MatchProfile = { bio: string; job: string | null; distanceKm: number; photos: string[]; prompts: MatchPrompt[]; passions: string[] };

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);

/** A profile read from the database, or null when it is missing or malformed (the app then shows the plain chat). */
export function parseMatchProfile(value: unknown): MatchProfile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const bio = str(v.bio, 600);
  const photos = Array.isArray(v.photos) ? v.photos.map((p) => str(p, 300)).filter((p): p is string => p !== null).slice(0, 6) : [];
  if (!bio || !photos.length) return null;
  const prompts = Array.isArray(v.prompts)
    ? v.prompts.flatMap((p) => { const q = str((p as Record<string, unknown>)?.q, 120); const a = str((p as Record<string, unknown>)?.a, 400); return q && a ? [{ q, a }] : []; }).slice(0, 4)
    : [];
  const passions = Array.isArray(v.passions) ? v.passions.map((p) => str(p, 40)).filter((p): p is string => p !== null).slice(0, 8) : [];
  const km = typeof v.distanceKm === "number" && Number.isFinite(v.distanceKm) ? Math.min(Math.max(Math.round(v.distanceKm), 1), 500) : 5;
  return { bio, job: str(v.job, 80), distanceKm: km, photos, prompts, passions };
}

/** How the match started, in the app's own terms. */
export function matchedVia(app: App): string {
  return app === "hinge" ? "She liked your profile and you matched" : app === "bumble" ? "You both swiped right on Bumble" : "You both swiped right";
}

/** "just now", "12 min ago", "3 h ago", "yesterday", "4 days ago". */
export function timeAgo(fromMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** Messages from the match that arrived after the user last opened the chat. Zero when read state is not tracked (lastReadAt null). */
export function unreadCount(messages: readonly { sender: string; sent_at: string }[], lastReadAt: string | null): number {
  if (!lastReadAt) return 0;
  const read = Date.parse(lastReadAt);
  return messages.filter((m) => m.sender === "match" && Date.parse(m.sent_at) > read).length;
}
