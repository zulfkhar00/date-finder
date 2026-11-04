import { DatesView } from "@/components/app/views";
import { listDates } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Dates" };

export default async function DatesPage() {
  await requireUser();
  return <DatesView dates={await listDates(await createAppClient())} />;
}
