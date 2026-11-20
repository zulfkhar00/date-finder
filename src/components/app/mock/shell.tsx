"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/shell";
import { needsYouChats } from "@/lib/app/mock-core";
import { useMock } from "@/lib/app/mock-store";

/** The preview's frame: the same bottom nav as the real app, pointed at /app, with a strip saying this is sample data. */
export function MockShell({ children }: { children: ReactNode }) {
  const s = useMock();
  const router = useRouter();
  const pending = s ? !s.onboarding.done : false;
  // Someone who has not finished (or restarted) onboarding in the preview is sent there first.
  useEffect(() => { if (pending) router.replace("/app/onboarding"); }, [pending, router]);
  const banner = (
    <div className="app-banner app-preview-banner" role="note"><span>Preview · sample data on this device only. Nothing is sent.</span></div>
  );
  return (
    <AppShell base="/app" needsYou={s ? needsYouChats(s).length : 0} banner={banner}>
      {s && !pending ? children : <div className="app-empty" role="status" aria-label="Loading"><span className="app-spinner" aria-hidden /></div>}
    </AppShell>
  );
}
