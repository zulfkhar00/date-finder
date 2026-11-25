import { requireOwner } from "@/lib/app/owner-gate";
import { MockOnboarding } from "@/components/app/mock/onboarding";

export default async function Page() {
  await requireOwner();
  return <MockOnboarding />;
}
