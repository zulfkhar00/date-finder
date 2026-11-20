import { requireOwner } from "@/lib/app/owner-gate";
import { MockDateDetail } from "@/components/app/mock/date-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  return <MockDateDetail id={id} />;
}
