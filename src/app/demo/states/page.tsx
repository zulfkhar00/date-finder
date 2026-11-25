import type { Metadata } from "next";
import { buildDemo } from "@/lib/app/demo-data";
import { DemoStates } from "./states";

export const metadata: Metadata = { title: "Account states", robots: { index: false, follow: false } };

export default function DemoStatesPage() {
  const d = buildDemo();
  return <DemoStates now={d.now} activity={d.activity} />;
}
