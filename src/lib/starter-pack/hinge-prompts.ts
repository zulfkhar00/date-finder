// Prompts that exist in Hinge's prompt picker. Answers are only accepted for these titles, so the pack never
// tells someone to answer a prompt the app does not offer.
export const HINGE_PROMPTS = [
  "A life goal of mine", "A shower thought I recently had", "A random fact I love", "All I ask is that you",
  "Best travel story", "Biggest risk I've taken", "Change my mind about", "Dating me is like",
  "Don't hate me if I", "Fact about me that surprises people", "First round is on me if", "Green flags I look for",
  "I geek out on", "I go crazy for", "I want someone who", "I'll fall for you if",
  "I'm looking for", "I'm weirdly attracted to", "I'm convinced that", "Let's debate this topic",
  "My love language is", "My most irrational fear", "My simple pleasures", "My happy place",
  "Never have I ever", "One thing I'll never do again", "Teach me something about", "The best way to ask me out is",
  "The key to my heart is", "The way to win me over is", "This year, I really want to", "Together, we could",
  "Two truths and a lie", "Typical Sunday", "Unusual skills", "We're the same type of weird if",
  "What I order for the table", "Worst idea I've ever had", "You should leave a comment if", "Weekends are for"
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const BY_NORM = new Map<string, string>(HINGE_PROMPTS.map((p) => [norm(p), p]));

/** The exact Hinge title for what the model wrote, or null when it is not a real prompt. */
export function canonicalHingePrompt(raw: string): string | null {
  return BY_NORM.get(norm(raw)) ?? null;
}
