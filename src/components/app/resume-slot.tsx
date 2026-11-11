import { ResumeCard } from "@/components/app/resume-card";
import { getActivation } from "@/lib/app/activation";

/** Top-of-page "finish setting up" card for signed-in, onboarded, unpaid users. Renders nothing for everyone else. */
export async function ResumeSlot() {
  const data = await getActivation();
  return data ? <ResumeCard data={data} /> : null;
}
