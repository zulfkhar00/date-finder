import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ReserveForm } from "@/components/reserve-form";

export const metadata: Metadata = { title: "Reserve early access — Morrow" };

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <div className="interior-page"><SiteHeader /><main className="interior-shell"><div className="reserve-intro"><div><p className="eyebrow"><span className="eyebrow-line" /> Early access</p><h1>A good beginning<br /><em>starts here.</em></h1></div><p>A few thoughtful details, then a $1 one-time, nonrefundable reservation for the waitlist. Concierge access is separate and will have its own pricing.</p></div><div className="reserve-layout"><aside className="reserve-aside"><span>YOUR RESERVATION</span><h2>An invitation to be first.</h2><p>An intentional way to date starts here. Your answers help us understand where to offer access first.</p><ul><li>01 / Share a few details</li><li>02 / Review the $1 reservation</li><li>03 / Pay securely with Stripe</li></ul></aside><ReserveForm cancelled={cancelled === "1"} /></div></main></div>;
}
