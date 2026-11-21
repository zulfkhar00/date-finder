import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

/** The Reply helper entry point: one line on what it does and one button. Real app only (not /demo). */
export function ReplyHelperCard({ empty }: { empty?: boolean }) {
  return (
    <section className="app-card rh-cta" aria-label="Reply helper" data-testid="reply-helper-cta" data-empty={empty ? "true" : undefined}>
      <div className="sp-head"><Sparkles size={18} aria-hidden /><h2>Reply helper</h2></div>
      <p>{empty ? "No chats here yet, but you can use this today: upload a screenshot of any chat and get three replies in your own voice." : "Stuck on what to say? Upload a screenshot of any chat and get three replies in your voice."}</p>
      <Link href="/chats/reply" className="app-btn">Get replies<ChevronRight size={18} aria-hidden /></Link>
    </section>
  );
}
