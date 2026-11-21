import { requireOwner } from "@/lib/app/owner-gate";
import { MockProfile } from "@/components/app/mock/profile";

export default async function Page() {
  await requireOwner();
  return <MockProfile />;
}
