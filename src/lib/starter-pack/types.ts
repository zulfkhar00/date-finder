// Types and the output contract for "Your starter pack". Pure (zod only), so `npm test` imports it directly.
import { z } from "zod";

/** Bump to give every user a fresh pack (a new row; the old one stays). One pack per user per version. */
export const PACK_VERSION = 1;
export const PACK_MODEL = "claude-sonnet-5-5";
/** Cheap classifier for the photo-flag sweep. */
export const FLAG_MODEL = "claude-haiku-5-5";

export const PACK_APPS = ["hinge", "tinder", "bumble", "general"] as const;
export type PackApp = (typeof PACK_APPS)[number];
export const BIO_LIMITS: Record<PackApp, number> = { hinge: 150, tinder: 500, bumble: 300, general: 300 };

const line = (max: number) => z.string().trim().min(1).max(max);

export const profileEntrySchema = z.object({
  app: z.enum(PACK_APPS),
  prompts: z.array(z.object({ prompt: line(80), answer: line(220) })).max(3).optional(),
  bio: line(500)
});
export const photoRankSchema = z.object({
  kind: z.literal("ranked"),
  order: z.array(z.object({ photo_id: z.string().uuid(), role: z.enum(["lead", "keep", "drop"]), reason: line(220) })).min(1).max(12),
  add: z.array(line(160)).max(4),
  note: line(200).optional()
});
export const photoChecklistSchema = z.object({
  kind: z.literal("checklist"),
  items: z.array(line(200)).min(1).max(8),
  note: line(200).optional()
});
const openerSchema = z.object({ line: line(200), why: line(160) });
const replySchema = z.object({ situation: line(90), template: line(300) });
const datePlanSchema = z.object({
  headline: line(90),
  venues: z.array(z.object({ type: line(70), why: line(200) })).length(2),
  when: line(110),
  budget: line(70),
  backup: line(220),
  tip: line(220).optional()
});

/** What the text call must return (before trimming to the exact counts). */
export const textPackSchema = z.object({
  profiles: z.array(profileEntrySchema).min(1).max(3),
  openers: z.array(openerSchema).min(5),
  replies: z.array(replySchema).min(3),
  datePlan: datePlanSchema.extend({ venues: z.array(z.object({ type: line(70), why: line(200) })).min(2) })
});
/** What is stored and shown. */
export const packContentSchema = z.object({
  v: z.literal(1),
  profiles: z.array(profileEntrySchema).min(1).max(3),
  photos: z.union([photoRankSchema, photoChecklistSchema]),
  openers: z.array(openerSchema).length(5),
  replies: z.array(replySchema).length(3),
  datePlan: datePlanSchema
});
export type PackContent = z.infer<typeof packContentSchema>;
export type TextPack = z.infer<typeof textPackSchema>;
export type PhotoSection = PackContent["photos"];

export type PackStatus = "pending" | "generating" | "ready" | "failed";
export type RunKind = "auto" | "regenerate" | "admin";

export type PackRow = {
  id: string; user_id: string; version: number; status: PackStatus; content: PackContent | null;
  attempts: number; last_error: string | null; tokens: number; model: string | null;
  lease_until: string | null; next_attempt_at: string | null; generated_at: string | null; updated_at: string;
};

/** Everything the prompt may use. Built from the profile by buildContext (prompts.ts), already trimmed and cleaned. */
export type PackContext = {
  firstName: string | null; age: number | null; gender: string | null; target: string;
  job: string | null; city: string | null; interests: string[]; voice: "warm" | "playful" | "direct";
  goal: string | null; dealbreakers: string[]; apps: PackApp[];
};
