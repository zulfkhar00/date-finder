import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminState } from "@/lib/admin-auth";
import { signOut } from "./_lib/actions";
import { SubmitButton } from "./_components/submit-button";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: "Admin — NoSwipe",
  robots: { index: false, follow: false }
};

// The header is cosmetic. Every page, route handler and server action under /admin checks
// ADMIN_EMAILS itself; nothing relies on this layout for access control.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const state = await getAdminState();
  const admin = state.kind === "admin" ? state : null;
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.brand}>NoSwipe <span>admin</span></Link>
        {admin ? (
          <>
            <nav className={styles.nav}>
              <Link href="/admin" className={styles.navLink}>Overview</Link>
              <Link href="/admin/leads" className={styles.navLink}>Leads</Link>
            </nav>
            <div className={styles.headerRight}>
              <span>{admin.email}</span>
              <form action={signOut}>
                <SubmitButton ghost pendingLabel="Signing out…">Sign out</SubmitButton>
              </form>
            </div>
          </>
        ) : null}
      </header>
      {children}
    </div>
  );
}
