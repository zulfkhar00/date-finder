import type { ReactNode } from "react";
import { BottomNav } from "@/components/app/nav";

/** The signed-in app frame: content area plus the bottom nav. /demo uses the very same frame (base = "/demo"). */
export function AppShell({ children, base = "", needsYou = 0, banner, live }: { children: ReactNode; base?: string; needsYou?: number; banner?: ReactNode; live?: ReactNode }) {
  return (
    <div className="app-root">
      {banner}
      {live}
      <div className="app-main">{children}</div>
      <BottomNav base={base} needsYou={needsYou} />
    </div>
  );
}
