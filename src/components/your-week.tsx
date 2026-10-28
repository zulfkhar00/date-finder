// The in-app "Your week" screen, shown as an example of one member's dashboard. Illustrative
// numbers for a single account, not totals across customers.
const bars = [34, 52, 40, 78, 86, 92, 70];
const days = ["M", "T", "W", "T", "F", "S", "S"];
const feed = [
  { tag: "Swiping", text: "Swiping on 3 apps, only on who fits your type" },
  { tag: "Chatting", text: "NoSwipe is chatting for you in your voice" },
  { tag: "Booked", text: "Sat 11 AM, coffee with Maya. Shared her number, you take it from here" }
];

export function YourWeek() {
  return (
    <section id="app" className="section shell" aria-labelledby="week-title" style={{ paddingTop: 0 }}>
      <p className="kicker">Inside the app</p>
      <h2 id="week-title" className="h2">Everything NoSwipe did for you. <span className="mark">This week.</span></h2>
      <p className="lede">Open the app and see it: who we swiped on, who we’re chatting with, and the dates already on your calendar.</p>
      <div className="week">
        <div className="week-head">
          <strong>Your week</strong>
          <span className="example-tag week-tag">Example</span>
        </div>
        <div className="week-grid">
          <div className="week-tile week-coral week-wide"><span>Swipes done for you</span><b>640</b></div>
          <div className="week-tile week-dark"><span>Chats</span><b>38</b></div>
          <div className="week-tile week-lime"><span>Dates booked</span><b>3</b></div>
          <div className="week-tile week-dark week-chart">
            <span>Activity</span>
            <div className="week-bars" aria-hidden="true">{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            <div className="week-days" aria-hidden="true">{days.map((d, i) => <em key={i}>{d}</em>)}</div>
          </div>
          <div className="week-tile week-lilac"><span>Avg fit score</span><b>92%</b></div>
        </div>
        <ul className="week-feed">
          {feed.map((item) => <li key={item.tag}><span>{item.tag}</span>{item.text}</li>)}
        </ul>
      </div>
    </section>
  );
}
