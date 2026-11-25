import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";

export const revalidate = 60;

// Not a public URL: the proxy rewrites "/" here for the B bucket. Crawlers that reach it directly are told to index "/".
export const metadata: Metadata = { alternates: { canonical: "/" }, robots: { index: false, follow: true } };

export default function Page() {
  return <HomePage variant="b" />;
}
