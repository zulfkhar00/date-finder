/**
 * Smoke test for the concierge drafting prompts. Text-only fixture, no images, no database.
 * Skips (exit 0) when ANTHROPIC_API_KEY is not set.
 *
 *   ANTHROPIC_API_KEY=... npm run concierge:smoke
 */
import { draft } from "../src/lib/concierge/draft";
import type { DraftKind } from "../src/lib/concierge/types";

const client = {
  name: "Sam",
  voiceNotes: "28, product designer, moved to the city last year. Runs on weekends, bad at cooking but trying. Texts short and lowercase, dry humour, rarely uses emojis.",
  apps: ["Tinder", "Hinge"]
};

const fixtures: { kind: DraftKind; note: string }[] = [
  {
    kind: "reply",
    note: "Chat transcript (no screenshot). Her: haha ok the pancake story got me. Me: in my defense the pan was cursed. Her: lol fair. so what are you up to this weekend? Me: long run saturday then nothing planned. Her: nice, I've been wanting to try that new coffee place on 5th"
  },
  {
    kind: "opener",
    note: "Her profile (described, no screenshot): prompt 'My most irrational fear' -> 'geese. they know what they did.' Photos: hiking with a dog, a pottery class, a concert."
  }
];

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("concierge:smoke skipped: ANTHROPIC_API_KEY is not set.");
    return;
  }
  for (const fixture of fixtures) {
    const started = Date.now();
    const result = await draft({ kind: fixture.kind, client, images: [], note: fixture.note });
    if (!result) throw new Error("draft() returned null with a key set");
    if (!result.output.message.trim()) throw new Error(`${fixture.kind}: empty client message`);
    console.log(`\n=== ${fixture.kind} (${Date.now() - started} ms) ===`);
    console.log(`summary: ${result.inputSummary}`);
    console.log(`flags: ${result.output.operator_flags.join(" | ") || "none"}`);
    console.log(result.output.message);
  }
  console.log("\nconcierge:smoke passed.");
}

main().catch((error) => {
  console.error("concierge:smoke failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
