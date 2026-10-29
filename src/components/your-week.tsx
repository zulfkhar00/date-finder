const feed = [
  { tag: "Profile", text: "Photo-order notes and bio options ready for your review" },
  { tag: "Message", text: "Opener draft based on the profile context you shared" },
  { tag: "Plan", text: "Venue checklist and invitation draft — verify before sending" }
];

export function YourWeek() {
  return (
    <section id="app" className="section shell" aria-labelledby="week-title" style={{ paddingTop: 0 }}>
      <p className="kicker">Inside the app</p>
      <h2 id="week-title" className="h2">Your dating drafts. <span className="mark">In one place.</span></h2>
      <p className="lede">Review profile suggestions, message options and date plans without handing over a dating-app login.</p>
      <div className="week">
        <div className="week-head">
          <strong>Your draft pack</strong>
          <span className="example-tag week-tag">Example</span>
        </div>
        <div className="week-grid">
          <div className="week-tile week-coral week-wide"><span>Account access</span><b>Yours</b></div>
          <div className="week-tile week-dark"><span>Profile</span><b>Ready</b></div>
          <div className="week-tile week-lime"><span>Messages</span><b>Draft</b></div>
          <div className="week-tile week-lilac"><span>Date plan</span><b>Draft</b></div>
        </div>
        <ul className="week-feed">
          {feed.map((item) => <li key={item.tag}><span>{item.tag}</span>{item.text}</li>)}
        </ul>
      </div>
    </section>
  );
}
