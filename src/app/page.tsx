import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";

// Re-render at most once a minute so the founding-members count stays fresh without a
// database query on every visit.
export const revalidate = 60;

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Variant A of the home hero test. Variant B is the same page served by the proxy as a rewrite of "/" to
// /exp/home-b (src/proxy.ts, src/lib/hero-experiment.ts).
export default function Page() {
  return <HomePage variant="a" />;
}
