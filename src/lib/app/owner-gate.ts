import "server-only";
import { notFound } from "next/navigation";
import { getAppUser } from "@/lib/app/session";
import { isOwner, ownerAllowlist } from "@/lib/app/owner";

/**
 * Every page under /app (except the sign-in screens) calls this itself: layouts do not re-run on client navigation,
 * so a layout is never the only check. Not signed in, or signed in as anyone but an owner: a plain 404, so the
 * route does not reveal itself.
 */
export async function requireOwner(): Promise<void> {
  const user = await getAppUser();
  if (!isOwner(user, ownerAllowlist())) notFound();
}
