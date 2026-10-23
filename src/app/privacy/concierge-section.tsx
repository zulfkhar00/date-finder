/** Privacy note for the hand-run concierge pilot (Telegram bot + operator review). */
export function ConciergePrivacySection() {
  return (
    <>
      <h2>Concierge pilot</h2>
      <p>
        If you are invited to the concierge pilot, you send screenshots and photos to our Telegram bot and we send back drafts: profile text, openers, replies and date plans. A person on our team reviews every draft before you get it, and you send every message yourself. We never log in to, swipe on or message from your dating apps.
      </p>
      <p>
        <strong>What we store.</strong> Your first name, the apps you use, the notes you give us about yourself and how you write, your Telegram chat ID, and the numbers you share for your progress (matches per week, conversations, dates scheduled). For each request we keep a short text summary of what you sent, the draft we wrote, and our reviewer&apos;s notes. Before any of that text is saved we automatically remove phone numbers, @handles, email addresses and links.
      </p>
      <p>
        <strong>What we don&apos;t store.</strong> Your screenshots and photos. They are held in memory only while the draft is written, then discarded. They are never saved to disk, to our database or to file storage, never written to logs, and never used to train AI models.
      </p>
      <p>
        <strong>How long.</strong> Drafts, their summaries and reviewer notes are deleted 30 days after they are created. Each pilot member can send up to 20 requests in any 24 hours. Ask your concierge at any time and we will delete your client record.
      </p>
      <p>
        <strong>AI processing.</strong> To write a draft we send your screenshots, photos and note to Anthropic, which provides the Claude AI model, over its commercial API. Anthropic processes them to return the draft and, under its commercial terms, does not use them to train its models. Telegram carries the messages between you and our bot under Telegram&apos;s own privacy policy.
      </p>
    </>
  );
}
