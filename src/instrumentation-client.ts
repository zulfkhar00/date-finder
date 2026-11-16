// Runs before hydration, so it stays tiny: Sentry and PostHog (~400 KB of script) are imported only after the
// page has loaded and the browser is idle. That keeps them off the critical path (mobile Lighthouse TBT).
type Monitoring = typeof import("@/lib/monitoring-client");
let loading: Promise<Monitoring> | undefined;
const load = () => (loading ??= import("@/lib/monitoring-client"));

if (typeof window !== "undefined") {
  const boot = () => { void load().catch(() => { /* Monitoring must never break the page. */ }); };
  const whenIdle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(boot, { timeout: 2000 }) : globalThis.setTimeout(boot, 2000));
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  void load().then((m) => m.onTransition(url, navigationType)).catch(() => { /* ignore */ });
}
