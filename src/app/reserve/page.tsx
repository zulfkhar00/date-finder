import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ReserveForm } from "@/components/reserve-form";

export const metadata: Metadata = { title: "Try it" };

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <div className="interior">
    <SiteHeader showCta={false} />
    <main className="shell">
      <div className="page-head">
        <span className="sticker">About 2 minutes</span>
        <h1>Let’s set you up.</h1>
        <p>Tell us about you and your type. Then reserve your spot in the next onboarding batch for $1 (nonrefundable). The service itself is separate and has its own pricing.</p>
      </div>
      <div className="reserve-grid">
        <aside className="reserve-side panel" style={{ background: "var(--lime)" }}>
          <p className="kicker" style={{ color: "var(--grape)" }}>What happens</p>
          <ul className="founding-list" style={{ marginTop: 16 }}>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Tell us about you and who you want to meet</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Reserve your spot in the next batch for $1</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Pay securely with Stripe, get your place in the queue</li>
          </ul>
          <p style={{ marginTop: 20, fontWeight: 600 }}>No photos or dating app details needed yet. We ask for those when your batch starts.</p>
        </aside>
        <ReserveForm cancelled={cancelled === "1"} />
      </div>
    </main>
  </div>;
}
