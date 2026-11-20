import "server-only";
import { headers } from "next/headers";
import { readAdminConfig, isAdminEmail } from "@/lib/admin-config";
import { decidePaid, geoCountry, isProduction, type PaidDecision } from "@/lib/paid-countries";
import { getAppUser } from "@/lib/app/session";

/**
 * Is checkout offered to the person making this request? Geo header + PAID_COUNTRIES, with one override: a confirmed
 * app session whose email is in ADMIN_EMAILS (the founders, to test the paid flow from anywhere). The app session
 * cookie is sent on every path, unlike the /admin cookie, so this works on /api/checkout and on app pages.
 */
export async function paidAccessFor(requestHeaders?: Headers): Promise<PaidDecision> {
  const source = requestHeaders ?? (await headers());
  const country = geoCountry(source);
  const base = decidePaid({ country, production: isProduction() });
  if (base.allowed) return base;
  try {
    const { config } = readAdminConfig();
    const user = await getAppUser();
    if (config && user && isAdminEmail(config, user.email)) return decidePaid({ country, production: isProduction(), override: true });
  } catch {
    // no session or config: the plain decision stands
  }
  return base;
}
