import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ConfirmationClient } from "@/components/confirmation-client";

export const metadata: Metadata = { title: "You’re in", robots: { index: false, follow: false } };

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return <div className="interior"><SiteHeader showCta={false} /><main className="shell"><ConfirmationClient sessionId={session_id} /></main></div>;
}
