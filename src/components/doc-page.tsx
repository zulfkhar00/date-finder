import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ogImages } from "@/lib/og";

export const SUPPORT_EMAIL = "support@noswipe.app";

// Same layout as /terms and /privacy: interior shell, "The details" kicker, .doc body.
export function docMetadata(path: string, title: string, ogTitle: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: { images: ogImages, title: ogTitle, description, url: path },
    twitter: { images: ogImages, title: ogTitle, description }
  };
}

export function DocPage({ heading, children }: { heading: string; children: React.ReactNode }) {
  return <div className="interior">
    <SiteHeader />
    <main className="shell doc">
      <div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <p className="kicker">The details</p>
        <h1>{heading}</h1>
      </div>
      {children}
    </main>
    <SiteFooter />
  </div>;
}
