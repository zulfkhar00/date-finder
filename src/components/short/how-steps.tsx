import { CalendarCheck, MessagesSquare, SlidersHorizontal } from "lucide-react";

const steps = [
  { Icon: SlidersHorizontal, label: "Tell us your type" },
  { Icon: MessagesSquare, label: "We swipe and chat as you" },
  { Icon: CalendarCheck, label: "You show up to the date" }
];

/** Three icon steps. Shared by the home page and every guide, so the story is the same everywhere. */
export function HowSteps({ id = "how" }: { id?: string }) {
  return (
    <section id={id} className="shell short-how" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="short-h2">How it works</h2>
      <ol className="steps3">
        {steps.map(({ Icon, label }, i) => (
          <li key={label}>
            <span className="steps3-icon" aria-hidden="true"><Icon size={26} strokeWidth={2.4} /></span>
            <span className="steps3-num" aria-hidden="true">{i + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
