import Link from "next/link";
import styles from "../admin.module.css";

export const MIGRATION_QUALITY = "supabase/2026-11-22-session-quality.sql";

/**
 * Says how many sessions were left out as likely bots / suspect, why, and offers the toggle. Plain links (no
 * async work), so the choice is a shareable URL: ?suspect=1 counts suspect sessions, bots are never counted.
 */
export function QualityNote({ includeSuspect, note, suspectCount, hrefToggle, qualityColumn = true }: { includeSuspect: boolean; note: string | null; suspectCount: number; hrefToggle: string; qualityColumn?: boolean }) {
  return (
    <div className={styles.notice} role="status">
      <strong>{includeSuspect ? "Including suspect sessions." : "Human sessions only."}</strong>{" "}
      {note ?? (includeSuspect ? "No bots were found in this range." : "No bots or suspect sessions in this range.")}
      {!includeSuspect && suspectCount > 0 ? ` Include suspect to add ${suspectCount} back.` : ""}{" "}
      <Link href={hrefToggle} scroll={false} prefetch={false} style={{ fontWeight: 700, textDecoration: "underline" }}>{includeSuspect ? "Hide suspect sessions" : "Include suspect sessions"}</Link>
      {!qualityColumn ? <> Request checks (language, network) start once <code>{MIGRATION_QUALITY}</code> is applied; until then only crawler user agents and one-page-view direct visits are caught.</> : null}
    </div>
  );
}
