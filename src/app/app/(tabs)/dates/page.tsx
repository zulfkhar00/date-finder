import { requireOwner } from "@/lib/app/owner-gate";
import { MockDates } from "@/components/app/mock/screens";

export default async function Page() {
  await requireOwner();
  return <MockDates />;
}
