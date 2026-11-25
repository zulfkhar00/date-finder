import { ResumeCard } from "@/components/app/resume-card";
import { getActivation } from "@/lib/app/activation";
import { paidAccessFor } from "@/lib/paid-access";

/** Top-of-page "finish setting up" card for signed-in, onboarded, unpaid users. Renders nothing for everyone else. */
export async function ResumeSlot() {
  const data = await getActivation();
  if (!data) return null;
  return <ResumeCard data={data} paidOffered={(await paidAccessFor()).allowed} />;
}
