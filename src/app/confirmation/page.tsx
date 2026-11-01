import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ConfirmationClient } from "@/components/confirmation-client";
import { ogImages } from "@/lib/og";

const description = "Check the status of your NoSwipe early-access reservation.";

export const metadata: Metadata = {
  title: "Early-access reservation",
  description,
  openGraph: { images: ogImages, title: "NoSwipe early-access reservation", description },
  twitter: { images: ogImages, title: "NoSwipe early-access reservation", description },
  robots: { index: false, follow: false }
};

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return <div className="interior"><SiteHeader showCta={false} /><main className="shell"><ConfirmationClient sessionId={session_id} /></main></div>;
}
