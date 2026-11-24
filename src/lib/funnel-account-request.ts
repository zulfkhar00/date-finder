import "server-only";
import { readAppConfig } from "@/lib/app/config";
import { createAppClient } from "@/lib/app/session";
import { funnelAccount, type FunnelAccount } from "@/lib/funnel-account";

/**
 * The signed-in account for this request, or null for a guest. Costs nothing for guests (no cookie, no call).
 * Never throws: analytics must not break because auth is down; the event is then recorded as a guest event.
 */
export async function accountFromRequest(request: Request): Promise<FunnelAccount | null> {
  if (!(request.headers.get("cookie") ?? "").includes("ns-session")) return null;
  if (!readAppConfig()) return null;
  try {
    const supabase = await createAppClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    const email = typeof data.claims.email === "string" ? data.claims.email : null;
    return funnelAccount(typeof data.claims.sub === "string" ? data.claims.sub : null, email);
  } catch {
    return null;
  }
}
