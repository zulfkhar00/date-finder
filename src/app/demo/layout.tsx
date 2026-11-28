import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";
import { CtaLink } from "@/components/cta-link";
import { FunnelTracker } from "@/components/funnel-tracker";
import { ogImages } from "@/lib/og";

const title = "NoSwipe demo with sample data";
const description = "A look inside NoSwipe with sample people and sample chats. Nothing here is a real person or a real result.";

export const metadata: Metadata = {
  title: "Demo",
  description,
  alternates: { canonical: "/demo" },
  openGraph: { images: ogImages, type: "website", siteName: "NoSwipe", title, description, url: "/demo" },
  twitter: { images: ogImages, card: "summary_large_image", title, description }
};
export const revalidate = 3600;

// The sample banner keeps the demo explicit and offers the real signup path.
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <FunnelTracker event="page_view" />
      <AppShell base="/demo" needsYou={1} banner={
        <div className="app-banner app-demo-banner" role="note">
          <span>Demo · sample people and sample chats</span>
          <CtaLink location="demo_banner" className="app-demo-start">Get started</CtaLink>
        </div>
      }>{children}</AppShell>
    </>
  );
}
