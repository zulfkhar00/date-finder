import styles from "./admin.module.css";

// Shown instantly on every admin navigation (tab, range, filters, lead), so a click never looks dead
// while the server page loads its numbers.
export default function AdminLoading() {
  return (
    <main className={styles.main} aria-busy="true" aria-live="polite">
      <div className={styles.loadingBar} />
      <div className={styles.skeletonHead} />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.skeletonCard} />)}
      </div>
      <div className={styles.skeletonBlock} />
      <span className={styles.srOnly}>Loading…</span>
    </main>
  );
}
