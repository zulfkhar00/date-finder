import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";

export const revalidate = 60;

// Not a public URL: the proxy rewrites "/" here for the B bucket, so this metadata is what B visitors get on "/".
// No noindex: the canonical alone tells crawlers that reach this path directly to index "/".
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return <HomePage variant="b" />;
}
