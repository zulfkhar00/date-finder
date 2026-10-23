import { redirect } from "next/navigation";
import { adminAuthConfigured, getAdmin } from "@/lib/admin-auth";
import { LoginForm } from "../ui";
import styles from "../operator.module.css";

export default async function OperatorLogin({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next?.startsWith("/operator") ? next : "/operator";
  if (await getAdmin()) redirect(safeNext);
  return (
    <main className={styles.login}>
      <h1 className={styles.brand}>Operator console</h1>
      {!adminAuthConfigured()
        ? <p className={styles.notice}>Sign-in is not configured. Set ADMIN_EMAILS, SUPABASE_URL and a Supabase key on the server (see DEPLOYMENT.md, Concierge pilot).</p>
        : <>
          {error && <p className={styles.notice}>That sign-in link was invalid or expired, or the address is not on the operator list. Request a new one.</p>}
          <LoginForm next={safeNext} />
        </>}
    </main>
  );
}
