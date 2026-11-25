import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";

/** The Reply helper entry point: one line on what it does and one button. Real app only (not /demo). */
export function ReplyHelperCard({ empty }: { empty?: boolean }) {
  return (
    <section className="app-card rh-cta" aria-label="Reply helper" data-testid="reply-helper-cta" data-empty={empty ? "true" : undefined}>
      <div className="sp-head"><Sparkles size={18} aria-hidden /><h2>Reply helper</h2></div>
      <p>{empty ? "No chats here yet. While we set up, see how we'll write as you: show us any chat and get the three replies we'd send in your voice." : "Not sure we sound like you? Show us any chat and see the replies we'd send in your voice, then tweak the tone."}</p>
      <Link href="/chats/reply" className="app-btn">See how we write as you<ChevronRight size={18} aria-hidden /></Link>
    </section>
  );
}
