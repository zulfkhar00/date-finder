import type { Metadata } from "next";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ReserveForm } from "@/components/reserve-form";

export const metadata: Metadata = { title: "Get started" };

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <div className="interior">
    <SiteHeader showCta={false} />
    <main className="shell">
      <div className="page-head">
        <span className="sticker">About 2 minutes</span>
        <h1>Let’s set you up.</h1>
        <p>Tell us about you, your type and your apps. NoSwipe takes it from there.</p>
      </div>
      <div className="reserve-grid">
        <aside className="reserve-side panel" style={{ background: "var(--lime)" }}>
          <p className="kicker" style={{ color: "var(--grape)" }}>What happens</p>
          <ul className="founding-list" style={{ marginTop: 16 }}>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Tell us about you and who you want to meet</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Pick the apps we run for you</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> We set up your profiles and start swiping</li>
          </ul>
          <p style={{ marginTop: 20, fontWeight: 600 }}>No photos needed right now. We ask for them when we set you up.</p>
        </aside>
        <ReserveForm cancelled={cancelled === "1"} />
      </div>
    </main>
  </div>;
}
