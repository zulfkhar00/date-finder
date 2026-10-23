import { FunnelTracker } from "@/components/funnel-tracker";
import { LandingPage } from "@/components/landing-page";

// Re-render at most once a minute so the founding-members count stays fresh without a
// database query on every visit.
export const revalidate = 60;

export default function Page() { return <><FunnelTracker event="page_view" /><LandingPage /></>; }
