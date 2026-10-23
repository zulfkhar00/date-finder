import Link from "next/link";
import styles from "./concierge.module.css";

// Sign-in, the signed-in email and Sign out live in the shared /admin layout header.
export function ConciergeHeader({ active }: { active: "queue" | "clients" }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.brand}>Concierge</h1>
      <nav className={styles.nav} aria-label="Concierge">
        <Link href="/admin/concierge" className={active === "queue" ? styles.navActive : undefined}>Draft queue</Link>
        <Link href="/admin/concierge/clients" className={active === "clients" ? styles.navActive : undefined}>Clients</Link>
      </nav>
    </header>
  );
}

export function ConfigNotices() {
  const missing: string[] = [];
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) missing.push("TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET (intake and delivery are off)");
  if (!process.env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY (drafting is off)");
  if (!missing.length) return null;
  return <p className={styles.notice}>Not configured: {missing.join("; ")}.</p>;
}
