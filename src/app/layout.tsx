import type { Metadata, Viewport } from "next";
import "@fontsource/bagel-fat-one/latin-400.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";

const description = "We find you dates on Tinder, Bumble and Hinge. We build your profiles, swipe, chat and book the date. You just show up.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.noswipe.app"),
  title: { default: "NoSwipe — we swipe, you date", template: "%s — NoSwipe" },
  description,
  applicationName: "NoSwipe",
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "NoSwipe", title: "NoSwipe — we swipe, you date", description, url: "/" },
  twitter: { card: "summary_large_image", title: "NoSwipe — we swipe, you date", description }
};

export const viewport: Viewport = { themeColor: "#FFF8F0" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
