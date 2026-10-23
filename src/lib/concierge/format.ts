import type { DraftOutput } from "./types";

/** Plain-text message the client receives on Telegram once the operator approves the draft. */
export function formatClientMessage(output: DraftOutput): string {
  const lines: string[] = [];
  switch (output.kind) {
    case "profile": {
      lines.push("Your profile build");
      if (output.photo_ranking.length) {
        lines.push("", "Photos, best first:");
        for (const photo of output.photo_ranking) lines.push(`- Photo ${photo.photo}: ${photo.verdict} (${photo.reason})`);
      }
      for (const app of output.per_app) {
        lines.push("", app.app.toUpperCase(), "Bio:", app.bio);
        for (const prompt of app.prompts) lines.push("", prompt.prompt, prompt.answer);
      }
      if (output.settings_to_change.length) {
        lines.push("", "Settings to change:");
        for (const setting of output.settings_to_change) lines.push(`- ${setting}`);
      }
      break;
    }
    case "opener":
      lines.push("Three openers, pick one:");
      output.openers.forEach((opener, index) => lines.push("", `${index + 1}. ${opener.text}`));
      break;
    case "reply":
      if (output.respect_note) lines.push(output.respect_note);
      if (output.reply) lines.push(...(lines.length ? [""] : []), "Reply:", output.reply);
      if (output.alternative) lines.push("", "Or:", output.alternative);
      if (output.ask_out_now && output.date_ask) lines.push("", "The chat is warm. Ask her out now:", output.date_ask);
      break;
    case "date_plan":
      lines.push("Date plan");
      output.places.forEach((place, index) => lines.push("", `${index + 1}. ${place.name} (${place.area}): ${place.why}`));
      lines.push("", `When: ${output.time}`, "", "Message to send:", output.proposal);
      break;
  }
  lines.push("", "You send it yourself, when it feels right.");
  return lines.join("\n").trim();
}

/** The text that actually goes to the client: the operator's edit if there is one. */
export function finalMessage(output: Pick<DraftOutput, "message" | "edited_message">) {
  return (output.edited_message ?? output.message ?? "").trim();
}
