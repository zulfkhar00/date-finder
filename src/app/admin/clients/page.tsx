import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Badge, SetupNotice } from "../_components/notices";
import { formatDateTime } from "../_lib/format";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  const sb = getSupabaseAdmin();
  const { data: profiles, error } = await sb.from("profiles").select("user_id, first_name, city, internal, onboarding_done_at, created_at").order("created_at", { ascending: false }).limit(100);
  const ids = (profiles ?? []).map((p) => p.user_id);
  const [{ data: apps }, users] = await Promise.all([
    ids.length ? sb.from("app_accounts").select("user_id, app, status, user_paused").in("user_id", ids) : Promise.resolve({ data: [] as { user_id: string; app: string; status: string; user_paused: boolean }[] }),
    Promise.all(ids.map(async (id) => [id, (await sb.auth.admin.getUserById(id)).data.user?.email ?? ""] as const))
  ]);
  const email = new Map(users);
  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div><h1>Clients</h1><p className={styles.sub}>People who signed up in the app. Open one to set app status, add matches, messages and dates.</p></div>
      </div>
      <section className={styles.card}>
        {error ? <div className={styles.notice}>Couldn&rsquo;t read clients. Has <code>supabase/2026-11-04-app.sql</code> been applied?</div> : null}
        {!profiles?.length ? <div className={styles.empty}>No clients yet.</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Joined</th><th>Name</th><th>Email</th><th className={styles.hideSm}>City</th><th>Apps</th><th>Onboarding</th></tr></thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.user_id}>
                    <td className={styles.nowrap}>{formatDateTime(p.created_at)}</td>
                    <td><Link href={`/admin/clients/${p.user_id}`} className={styles.rowLink}>{p.first_name || "—"}</Link> {p.internal ? <span className={styles.badge}>internal</span> : null}</td>
                    <td>{email.get(p.user_id)}</td>
                    <td className={styles.hideSm}>{p.city ?? "—"}</td>
                    <td>{(apps ?? []).filter((a) => a.user_id === p.user_id).map((a) => <span key={a.app} className={styles.badge} style={{ marginRight: 4 }}>{a.app}: {a.user_paused ? "paused (user)" : a.status}</span>)}</td>
                    <td>{p.onboarding_done_at ? <Badge value="paid" label="Done" /> : <Badge value="pending" label="In progress" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
