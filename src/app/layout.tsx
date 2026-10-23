import type { Metadata, Viewport } from "next";
import "@fontsource/bagel-fat-one/latin-400.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";

const description = "Few matches? Chats that die after “haha”? We rebuild your dating profile and write your texts. You hit send and go on the date. Get on the waitlist for $1.";

export const metadata: Metadata = {
  metadataBase: new URL("https://noswipe.app"),
  title: { default: "NoSwipe — stop swiping, start dating", template: "%s — NoSwipe" },
  description,
  applicationName: "NoSwipe",
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "NoSwipe", title: "NoSwipe — stop swiping, start dating", description, url: "/" },
  twitter: { card: "summary_large_image", title: "NoSwipe — stop swiping, start dating", description }
};

export const viewport: Viewport = { themeColor: "#FFF8F0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
