import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";

export const metadata: Metadata = {
  title: "Demo",
  description: "A look inside NoSwipe with sample people and sample chats. Nothing here is a real person or a real result.",
  alternates: { canonical: "/demo" }
};
export const revalidate = 3600;

// The demo is the real app frame with sample data. The slim banner is the only addition.
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <AppShell base="/demo" needsYou={1} banner={<div className="app-banner" role="note">Demo · sample people and sample chats</div>}>{children}</AppShell>;
}
