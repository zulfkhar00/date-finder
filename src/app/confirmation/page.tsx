import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ConfirmationClient } from "@/components/confirmation-client";

export const metadata: Metadata = { title: "Reservation status — Morrow", robots: { index: false, follow: false } };

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return <div className="interior-page"><SiteHeader /><main className="interior-shell"><div className="confirmation-hero"><p className="eyebrow"><span className="eyebrow-line" /> Your reservation</p><ConfirmationClient sessionId={session_id} /></div></main></div>;
}
