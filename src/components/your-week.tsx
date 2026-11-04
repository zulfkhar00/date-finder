const feed = [
  { tag: "Match", text: "Maya, 28 · Hinge · new this week" },
  { tag: "Chat", text: "Maya: “Thursday works! 7?” · NoSwipe is chatting" },
  { tag: "Date", text: "Taco place on 5th · Thursday 7:00 PM" }
];

export function YourWeek() {
  return (
    <section id="app" className="section shell" aria-labelledby="week-title" style={{ paddingTop: 0 }}>
      <p className="kicker">Inside the app</p>
      <h2 id="week-title" className="h2">Your week. <span className="mark">In one place.</span></h2>
      <p className="lede">See your matches, read your chats as they happen, and jump in whenever you want. Your dates show up when they are booked.</p>
      <div className="week">
        <div className="week-head">
          <strong>Your week</strong>
          <span className="example-tag week-tag">Example</span>
        </div>
        <div className="week-grid">
          <div className="week-tile week-coral week-wide"><span>Matches</span><b>Here</b></div>
          <div className="week-tile week-dark"><span>Chats</span><b>Live</b></div>
          <div className="week-tile week-lime"><span>Pause</span><b>Anytime</b></div>
          <div className="week-tile week-lilac"><span>Dates</span><b>Booked</b></div>
        </div>
        <ul className="week-feed">
          {feed.map((item) => <li key={item.tag}><span>{item.tag}</span>{item.text}</li>)}
        </ul>
      </div>
    </section>
  );
}
