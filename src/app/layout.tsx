import type { Metadata, Viewport } from "next";
import "@fontsource/bagel-fat-one/latin-400.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";

const title = "NoSwipe — dating profiles and message drafts";
const description = "Screenshot-based help for dating profiles, openers, replies and first-date plans. You keep every account and send every message yourself.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.noswipe.app"),
  title: { default: title, template: "%s — NoSwipe" },
  description,
  applicationName: "NoSwipe",
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "NoSwipe", title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description }
};

export const viewport: Viewport = { themeColor: "#FFF8F0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
