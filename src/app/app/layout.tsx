import type { Metadata } from "next";
import type { ReactNode } from "react";

// The owner preview. Nothing here is indexed; access is checked by each page (see src/lib/app/owner-gate.ts).
export const metadata: Metadata = { title: { default: "NoSwipe", template: "%s — NoSwipe" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function OwnerAppLayout({ children }: { children: ReactNode }) {
  return children;
}
