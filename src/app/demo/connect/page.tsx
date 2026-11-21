import type { Metadata } from "next";
import { DemoConnect } from "./demo-connect";

export const metadata: Metadata = { title: "Connect your apps", robots: { index: false, follow: false } };

// The Connect your apps step on its own, with nothing saved. For review only: linked from nowhere, not indexed.
export default function DemoConnectPage() {
  return <DemoConnect />;
}
