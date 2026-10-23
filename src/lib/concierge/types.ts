export const DRAFT_KINDS = ["profile", "opener", "reply", "date_plan"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DRAFT_STATUSES = ["pending", "approved", "edited", "rejected", "sent_to_client", "failed"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const CLIENT_STATUSES = ["pilot", "paused", "done"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const KIND_LABELS: Record<DraftKind, string> = {
  profile: "Profile build",
  opener: "Openers",
  reply: "Reply",
  date_plan: "Date plan"
};

type Common = {
  input_summary: string;
  operator_flags: string[];
  /** Plain text the client receives, generated from the structured fields. */
  message: string;
  /** Set when the operator edits the text before sending. */
  edited_message?: string;
};

export type ProfileOutput = Common & {
  kind: "profile";
  photo_ranking: { photo: number; verdict: "lead" | "keep" | "cut"; reason: string }[];
  per_app: { app: string; bio: string; prompts: { prompt: string; answer: string }[] }[];
  settings_to_change: string[];
};
export type OpenerOutput = Common & { kind: "opener"; openers: { text: string; references: string }[] };
export type ReplyOutput = Common & {
  kind: "reply";
  read: string;
  warmth: "cold" | "neutral" | "warm";
  reply: string;
  alternative: string;
  ask_out_now: boolean;
  date_ask: string | null;
  respect_note: string | null;
};
export type DatePlanOutput = Common & {
  kind: "date_plan";
  places: { name: string; area: string; why: string }[];
  time: string;
  proposal: string;
};
export type DraftOutput = ProfileOutput | OpenerOutput | ReplyOutput | DatePlanOutput;

const CAPTION_ALIASES: Record<string, DraftKind> = {
  profile: "profile", bio: "profile", photos: "profile",
  opener: "opener", openers: "opener",
  reply: "reply", replies: "reply", chat: "reply",
  date: "date_plan", dateplan: "date_plan", date_plan: "date_plan", plan: "date_plan"
};

/** Reads the first word of a Telegram caption as the job kind; the rest is the client's note. */
export function parseCaption(caption: string | undefined): { kind: DraftKind | null; note: string } {
  const text = (caption ?? "").trim();
  const [first = "", ...rest] = text.split(/\s+/);
  const word = first.toLowerCase().replace(/^\//, "").replace(/[^a-z_]/g, "");
  const kind = CAPTION_ALIASES[word] ?? null;
  return { kind, note: (kind ? rest.join(" ") : text).slice(0, 1000) };
}
