import { Check, Hand } from "lucide-react";

type Draft = { title: string; initial: string; avatar: string; app: string; summary: string; into: string[]; output: string };

// Illustrative examples of what the service does, not customer stories or outcome claims.
const drafts: Draft[] = [
  {
    title: "Your profiles", initial: "P", avatar: "av-1", app: "Tinder · Hinge · Bumble",
    summary: "We create and set up your profile on each app you pick: photo order, bio and prompts, built from your real photos and what you tell us.",
    into: ["Photo order", "Bio and prompts", "Your type, your dealbreakers"],
    output: "Your real photos only"
  },
  {
    title: "Your chats", initial: "C", avatar: "av-2", app: "Hinge",
    summary: "Conversations keep going as you: first person, warm and casual, like a normal person. Read along any time.",
    into: ["Your tone", "Real replies", "Live in the app"],
    output: "Take over any chat, hand it back when you like"
  },
  {
    title: "Your dates", initial: "D", avatar: "av-3", app: "Any app",
    summary: "When a chat turns into a plan, the date lands in your Dates tab: who, where and when, with a short summary of what you talked about.",
    into: ["Who", "Where and when", "Add to calendar"],
    output: "One tap to your calendar"
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
            <Hand size={22} strokeWidth={2.4} aria-hidden="true" />
            <div>
              <strong>You stay in control</strong>
              <span>Pause an app or take over a chat in one tap</span>
            </div>
          </div>
          <p className="match-number"><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> {draft.output}</p>
        </li>
      ))}
    </ul>
  );
}
