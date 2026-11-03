import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ReserveForm } from "@/components/reserve-form";
import { ogImages } from "@/lib/og";

const description = "Join NoSwipe early access for a refundable $1: screenshot-based help with your profile, messages and first dates. You keep your dating-app accounts.";

export const metadata: Metadata = {
  title: "Reserve early access",
  description,
  alternates: { canonical: "/reserve" },
  openGraph: { images: ogImages, title: "Reserve NoSwipe early access", description, url: "/reserve" },
  twitter: { images: ogImages, title: "Reserve NoSwipe early access", description }
};

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <div className="interior">
    <SiteHeader showCta={false} />
    <main className="shell">
      <div className="page-head">
        <span className="sticker">About 2 minutes</span>
        <h1>Let’s set you up.</h1>
        <p>Tell us about you, your type and the apps where you want profile and message help.</p>
        <p><Link href="/try" className="text-link">Want to see it work first? Try it free.</Link></p>
      </div>
      <div className="reserve-grid">
        <aside className="reserve-side panel" style={{ background: "var(--lime)" }}>
          <p className="kicker" style={{ color: "var(--grape)" }}>What happens</p>
          <ul className="founding-list" style={{ marginTop: 16 }}>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Tell us about you and who you want to meet</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Pick the apps where you want advice and drafts</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> If access opens, we prepare profile, message and date-plan drafts</li>
          </ul>
          <p style={{ marginTop: 20, fontWeight: 600 }}>You keep your accounts, choose who to like and send every message yourself. No photos are needed to join the early-access list.</p>
        </aside>
        <ReserveForm cancelled={cancelled === "1"} />
      </div>
    </main>
  </div>;
}
