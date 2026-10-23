import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ReserveForm } from "@/components/reserve-form";

export const metadata: Metadata = { title: "Get on the list" };

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <div className="interior">
    <SiteHeader showCta={false} />
    <main className="shell">
      <div className="page-head">
        <span className="sticker">About 60 seconds</span>
        <h1>Get on the list.</h1>
        <p>Three quick questions, then a $1 one-time, nonrefundable waitlist fee. The service itself is separate and has its own pricing.</p>
      </div>
      <div className="reserve-grid">
        <aside className="reserve-side panel" style={{ background: "var(--lime)" }}>
          <p className="kicker" style={{ color: "var(--grape)" }}>What happens</p>
          <ul className="founding-list" style={{ marginTop: 16 }}>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Answer three quick questions</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Check what the $1 covers</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Pay securely with Stripe, get your number</li>
          </ul>
          <p style={{ marginTop: 20, fontWeight: 600 }}>We never ask for your dating app login. Not now, not later.</p>
        </aside>
        <ReserveForm cancelled={cancelled === "1"} />
      </div>
    </main>
  </div>;
}
