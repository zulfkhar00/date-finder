import styles from "../admin.module.css";

/** Shown instead of the dashboard when admin env vars are missing. Never throws. */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div className={styles.authWrap}>
      <div className={styles.authCard}>
        <h1>Admin is not set up yet</h1>
        <p className={styles.sub}>
          Set these server environment variables in Dokploy and redeploy:{" "}
          {missing.map((name, index) => (
            <span key={name}>
              {index > 0 ? ", " : ""}
              <code>{name}</code>
            </span>
          ))}
          . See DEPLOYMENT.md, section “Admin dashboard”.
        </p>
      </div>
    </div>
  );
}

export function SchemaNotice() {
  return (
    <div className={styles.notice}>
      The admin report functions are missing. Apply <code>supabase/2026-10-23-funnel-tracking.sql</code> and then{" "}
      <code>supabase/2026-10-23-admin.sql</code> in the Supabase SQL editor.
    </div>
  );
}

export function QueryErrorNotice() {
  return <div className={styles.notice}>Couldn&apos;t load data from Supabase. Reload in a moment; the server log has the error code.</div>;
}

export function Badge({ value, label }: { value: string; label?: string }) {
  const tone = styles[`badge_${value}`] ?? "";
  return <span className={`${styles.badge} ${tone}`}>{label ?? value}</span>;
}
