import type { ReactNode } from "react";
import { MockShell } from "@/components/app/mock/shell";
import { requireOwner } from "@/lib/app/owner-gate";

export default async function TabsLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  return <MockShell>{children}</MockShell>;
}
