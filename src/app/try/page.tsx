import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TryTool } from "@/components/try-tool";
import { ogImages } from "@/lib/og";

const description = "Free: upload your dating profile photos or a match's screenshot and get a photo ranking, bio, prompt answers, openers or reply options in about 15 seconds. Works for Tinder, Hinge and Bumble.";

export const metadata: Metadata = {
  title: "Try it free",
  description,
  alternates: { canonical: "/try" },
  openGraph: { images: ogImages, title: "Try NoSwipe free", description, url: "/try" },
  twitter: { images: ogImages, title: "Try NoSwipe free", description }
};

export default function TryPage() {
  return (
    <div className="interior">
      <SiteHeader showCta={false} />
      <main className="shell try-shell">
        <div className="page-head">
          <span className="sticker">Free · no sign-up</span>
          <h1>Try it on your profile.</h1>
          <p>Add your photos or a match&rsquo;s screenshot. In about 15 seconds you get a ranking, a bio, prompt answers, openers or replies, ready to copy. You pick what to use and send it yourself.</p>
        </div>
        <TryTool />
      </main>
      <SiteFooter />
    </div>
  );
}
