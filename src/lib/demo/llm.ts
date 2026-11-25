import "server-only";
import type { PackModel } from "@/lib/starter-pack/generate";
import { FLAG_MODEL, PACK_MODEL } from "@/lib/starter-pack/types";
import { cleanLine, costMicro, fillLine, type DatePlan, type TurnKind } from "./engine";
import type { Persona } from "./personas";

// The only place live demo mode talks to the model. Same client and key as the starter pack and the reply helper (server env only).
// A line is written by the model when it can be (inside the daily cap, answered in time, clean), and by the canned script when not:
// the chat always moves on and the demo never shows an error. Nothing here is logged.

export type Who = "him" | "her";
export type Turn = { from: Who; text: string };
export type LineRequest = {
  who: Who; persona: Persona; kind: TurnKind; plan: DatePlan; transcript: readonly Turn[]; direction: string;
  user: { job: string | null; city: string | null; interests: string[]; voice: string };
};
export type Line = { text: string; usedModel: boolean; costMicro: number };

const STAGE: Record<TurnKind, (plan: DatePlan) => string> = {
  chat: () => "Keep the conversation going naturally. React to what was just said and add one small thing of your own.",
  propose: (p) => `Suggest meeting ${p.day} at ${p.time} at a place called ${p.venue}. Say the venue name exactly. Keep it relaxed, not formal.`,
  confirm: (p) => `Say yes to meeting ${p.day} at ${p.time} at ${p.venue}. Warm and a little excited, one short line.`,
  close: (p) => `Confirm you will see her at ${p.venue} ${p.day} at ${p.time}. Short and warm, then stop.`
};

const BASE_RULES = "Write ONE text message, 1 to 2 short sentences, under 200 characters, casual like a real text. At most one emoji. No hashtags, no quotation marks around it. Flirty-but-clean, never explicit. No phone numbers, emails, links, social handles or street addresses. Never mention AI, apps being automated, assistants or NoSwipe. Reply with ONLY the message text.";

export function systemPrompt(req: LineRequest): string {
  if (req.who === "him") {
    const facts = [req.user.job ? `works as ${req.user.job}` : null, req.user.city ? `lives in ${req.user.city}` : null, req.user.interests.length ? `into ${req.user.interests.join(", ")}` : null].filter(Boolean).join("; ");
    const tone = req.user.voice === "direct" ? "direct and confident" : req.user.voice === "playful" ? "playful and teasing" : "warm and easygoing";
    return `You are texting as a guy in his twenties on ${req.persona.app}, writing to ${req.persona.name}. Write in the first person as him, in his own voice: ${tone}, never stiff, never a pickup line.${facts ? ` Known about him: ${facts}.` : ""} Do not invent other personal details about him. ${BASE_RULES}`;
  }
  return `You are ${req.persona.name}, ${req.persona.age}, on ${req.persona.app}. About you: ${req.persona.bio} You are texting a guy you matched with. Stay in character, natural and a bit playful. ${BASE_RULES}`;
}

export function userPrompt(req: LineRequest): string {
  const convo = req.transcript.slice(-10).map((t) => `${t.from === "him" ? "Him" : req.persona.name}: ${t.text}`).join("\n");
  return `${convo ? `Conversation so far:\n${convo}\n\n` : "No messages yet: you are opening the chat.\n\n"}${STAGE[req.kind](req.plan)}\nDirection for the gist, rewrite in your own words and do not copy it: ${fillLine(req.direction, req.plan)}\n\nWrite the next message from ${req.who === "him" ? "him" : req.persona.name}.`;
}

/**
 * The next line. `model` is null when the key is missing or the daily cap is spent. Any failure (timeout, refusal, a line that
 * fails `cleanLine`) falls back to the canned script line, which is the fully-filled direction.
 */
export async function writeLine(model: PackModel | null, req: LineRequest): Promise<Line> {
  const canned: Line = { text: fillLine(req.direction, req.plan), usedModel: false, costMicro: 0 };
  if (!model) return canned;
  try {
    const res = await model.complete({ system: systemPrompt(req), user: userPrompt(req), maxTokens: 120, model: req.who === "him" ? PACK_MODEL : FLAG_MODEL });
    const spent = costMicro(res.inputTokens, res.outputTokens);
    if (res.stopReason === "refusal" || res.stopReason === "max_tokens") return { ...canned, costMicro: spent };
    const text = cleanLine(res.text, { kind: req.kind, venue: req.plan.venue });
    return text ? { text, usedModel: true, costMicro: spent } : { ...canned, costMicro: spent };
  } catch {
    return canned;
  }
}
