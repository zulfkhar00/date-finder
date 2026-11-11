import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/bagel-fat-one/latin-400.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";
import "./app.css";

const title = "NoSwipe — AI that swipes, chats and books your dates";
const description = "Stop swiping. NoSwipe is AI dating automation for Tinder, Hinge and Bumble: it swipes on people who fit, chats in your voice and books the date. You just show up.";

const keywords = [
  "ai dating assistant", "dating app automation", "ai dating app automation", "ai that swipes for you", "auto swipe app",
  "tinder automation", "tinder ai", "tinder auto swipe", "tinder bot alternative", "hinge ai", "hinge automation", "hinge prompts ai",
  "bumble ai", "bumble automation", "ai wingman", "ai matchmaker", "ai dating concierge", "done for you dating",
  "dating app ghostwriter", "ai date planner", "ai dating coach", "online dating assistant", "dating profile writer",
  "raya", "the league", "coffee meets bagel", "okcupid", "feeld", "match.com", "plenty of fish", "badoo", "happn"
];

export const metadata: Metadata = {
  metadataBase: new URL("https://www.noswipe.app"),
  // GOOGLE_SITE_VERIFICATION overrides the token below when Search Console issues a new meta tag.
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || "FG463sEde4bFDRvBj8evdXtbiQOj2-dRzlC8_f4CW50" },
  title: { default: title, template: "%s — NoSwipe" },
  description,
  keywords,
  applicationName: "NoSwipe",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  openGraph: { type: "website", siteName: "NoSwipe", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description }
};

export const viewport: Viewport = { themeColor: "#FFF8F0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<Analytics /></body></html>;
}
