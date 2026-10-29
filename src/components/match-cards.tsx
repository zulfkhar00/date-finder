import { Check, FilePenLine } from "lucide-react";

type Draft = { title: string; initial: string; avatar: string; app: string; summary: string; into: string[]; output: string };

// Illustrative draft types, not customer stories or outcome claims.
const drafts: Draft[] = [
  {
    title: "Profile review", initial: "P", avatar: "av-1", app: "Tinder",
    summary: "A clear photo order, notes on what each image communicates, and bio options built from details you provide.",
    into: ["Photo order", "Bio options", "Honest edits"],
    output: "You choose every profile change"
  },
  {
    title: "Message draft", initial: "M", avatar: "av-2", app: "Hinge",
    summary: "Opener and reply options based only on the profile or conversation screenshot you choose to share.",
    into: ["Your context", "Your tone", "No copied lines"],
    output: "You edit and send the final message"
  },
  {
    title: "First-date plan", initial: "D", avatar: "av-3", app: "Any app",
    summary: "A low-pressure activity, invitation draft and logistics checklist shaped around the conversation.",
    into: ["Public venue", "Clear invite", "Easy logistics"],
    output: "You verify details and confirm the date"
  }
];

export function MatchCards() {
  return (
    <ul className="match-grid">
      {drafts.map((draft) => (
        <li className="match-card" key={draft.title}>
          <div className="match-card-head">
            <span className={`avatar ${draft.avatar}`}>{draft.initial}</span>
            <span className="who"><strong>{draft.title}</strong><span>{draft.app}</span></span>
            <span className="example-tag">Example</span>
          </div>
          <p className="match-summary">{draft.summary}</p>
          <ul className="match-into" aria-label={`${draft.title} includes`}>
            {draft.into.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="match-date">
            <FilePenLine size={22} strokeWidth={2.4} aria-hidden="true" />
            <div>
              <strong>Draft, not action</strong>
              <span>Nothing changes or sends automatically</span>
            </div>
          </div>
          <p className="match-number"><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> {draft.output}</p>
        </li>
      ))}
    </ul>
  );
}
