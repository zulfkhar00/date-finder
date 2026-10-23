import { CalendarCheck, Check, MapPin } from "lucide-react";

type Match = { name: string; initial: string; avatar: string; app: string; summary: string; into: string[]; day: string; time: string; place: string };

// Made-up examples of what a client receives. No real people, no photos: initials only.
const matches: Match[] = [
  {
    name: "Maya", initial: "M", avatar: "av-1", app: "Hinge",
    summary: "Opened on her dog photo. Talked hiking and the best tacos in the Mission. She suggested Saturday.",
    into: ["Hiking", "Her dog Biscuit", "Tacos"],
    day: "Sat", time: "11:00 AM", place: "Coffee + walk, Dolores Park"
  },
  {
    name: "Jess", initial: "J", avatar: "av-2", app: "Bumble",
    summary: "She messaged first about your Lisbon photo. Swapped travel stories, she’s a big live-music person.",
    into: ["Travel", "Live music", "Natural wine"],
    day: "Thu", time: "8:00 PM", place: "Wine bar, Hayes Valley"
  },
  {
    name: "Priya", initial: "P", avatar: "av-3", app: "Tinder",
    summary: "Bonded over being terrible at Mario Kart. Competitive streak, wants a rematch in person.",
    into: ["Games", "Climbing", "Spicy food"],
    day: "Sun", time: "4:00 PM", place: "Climbing gym, then dinner"
  }
];

export function MatchCards() {
  return (
    <ul className="match-grid">
      {matches.map((m) => (
        <li className="match-card" key={m.name}>
          <div className="match-card-head">
            <span className={`avatar ${m.avatar}`} aria-hidden="true">{m.initial}</span>
            <span className="who"><strong>{m.name}</strong><span>Matched on {m.app}</span></span>
            <span className="example-tag">Example</span>
          </div>
          <p className="match-summary">{m.summary}</p>
          <ul className="match-into" aria-label="She’s into">
            {m.into.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="match-date">
            <CalendarCheck size={22} strokeWidth={2.4} aria-hidden="true" />
            <div>
              <strong>{m.day} · {m.time}</strong>
              <span><MapPin size={13} strokeWidth={2.6} aria-hidden="true" /> {m.place}</span>
            </div>
          </div>
          <p className="match-number"><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Her number, sent to you</p>
        </li>
      ))}
    </ul>
  );
}
