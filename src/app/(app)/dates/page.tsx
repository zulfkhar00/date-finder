import { ResumeSlot } from "@/components/app/resume-slot";
import { DatesView } from "@/components/app/views";
import { getApps, getSetupGaps, listDates } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Dates" };

export default async function DatesPage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const dates = await listDates(sb);
  const [apps, gaps] = dates.length ? [[], []] : await Promise.all([getApps(sb), getSetupGaps(sb, user.id)]);
  return <><ResumeSlot /><DatesView dates={dates} apps={apps} gaps={gaps} /></>;
}
