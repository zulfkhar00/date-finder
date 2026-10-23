import Link from "next/link";
import { SignOutButton } from "./ui";
import styles from "./operator.module.css";

export function OperatorHeader({ email, active }: { email: string; active: "queue" | "clients" }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.brand}>Concierge operator</h1>
      <nav className={styles.nav} aria-label="Operator">
        <Link href="/operator" className={active === "queue" ? styles.navActive : undefined}>Draft queue</Link>
        <Link href="/operator/clients" className={active === "clients" ? styles.navActive : undefined}>Clients</Link>
        <span className={styles.who}>{email}</span>
        <SignOutButton />
      </nav>
    </header>
  );
}

export function ConfigNotices() {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) missing.push("SUPABASE_URL / SUPABASE_SECRET_KEY");
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) missing.push("TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET (intake and delivery are off)");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY (drafting is off)");
  if (!missing.length) return null;
  return <p className={styles.notice}>Not configured: {missing.join("; ")}.</p>;
}
