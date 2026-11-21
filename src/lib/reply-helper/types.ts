// Types and the output contract for the Reply helper (Chats tab). Pure (zod only), so `npm test` imports it directly.
import { z } from "zod";
import type { ModelImage } from "@/lib/starter-pack/generate";
import { PACK_MODEL } from "@/lib/starter-pack/types";

/** The drafting model. Same one as the starter pack. */
export const REPLY_MODEL = PACK_MODEL;
export const MAX_IMAGES = 4;
export const MAX_TEXT_CHARS = 12_000;
export const TWEAKS = ["playful", "direct", "shorter"] as const;
export type Tweak = (typeof TWEAKS)[number];
export const TWEAK_LABELS: Record<Tweak, string> = { playful: "More playful", direct: "More direct", shorter: "Shorter" };
export const REPLY_KINDS = ["new", "regenerate", "tweak"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];

const line = (max: number) => z.string().trim().min(1).max(max);

const replySchema = z.object({ angle: line(40), text: line(500) });
const planSchema = z.object({ title: line(90), detail: line(260) });
const turnSchema = z.object({ from: z.enum(["them", "me"]), text: line(400) });

/** What the model must return. `status` lets it decline politely instead of inventing replies. */
export const modelOutputSchema = z.object({
  status: z.enum(["ok", "unreadable", "unsafe"]),
  language: line(40).optional(),
  read: line(220).optional(),
  transcript: z.array(turnSchema).max(14).optional(),
  replies: z.array(replySchema).min(3).optional(),
  dateMove: z.object({ ready: z.boolean(), line: line(400).optional(), plans: z.array(planSchema).min(2).optional() }).nullish()
});

/** What is stored and shown. */
export const draftsSchema = z.object({
  language: line(40),
  read: line(220),
  replies: z.array(replySchema).length(3),
  dateMove: z.object({ line: line(400), plans: z.array(planSchema).length(2) }).nullable()
});
export type Drafts = z.infer<typeof draftsSchema>;
export type Turn = z.infer<typeof turnSchema>;

export type ThreadSource = "screenshots" | "text";
export type ThreadRow = {
  id: string; user_id: string; source: ThreadSource; image_count: number; language: string | null;
  read_line: string | null; transcript: Turn[]; drafts: Drafts; tweak: Tweak | null; runs: number; created_at: string; updated_at: string;
};

/** The shape the client renders. Never includes the transcript. */
export type ThreadView = { id: string; source: ThreadSource; imageCount: number; tweak: Tweak | null; updatedAt: string; drafts: Drafts };

/** What the user's profile contributes to the prompt. Already cleaned. */
export type ReplyContext = {
  firstName: string | null; city: string | null; interests: string[]; voice: "warm" | "playful" | "direct";
  /** Up to three of the user's own starter-pack reply templates, as tone samples. */
  samples: string[];
};

export type ReplyInput =
  | { kind: "new"; images: ModelImage[]; text: string }
  | { kind: "regenerate" | "tweak"; thread: Pick<ThreadRow, "id" | "transcript" | "drafts" | "source" | "image_count">; tweak: Tweak | null };

export type ReplyOutcome =
  | { status: "ok"; thread: ThreadView }
  | { status: "unreadable" }
  | { status: "refused" }
  | { status: "denied"; reason: "cap" | "user_limit" | "busy" }
  | { status: "failed"; code: string };
