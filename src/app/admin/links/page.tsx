import { requireAdminPage } from "@/lib/admin-auth";
import { SetupNotice } from "../_components/notices";
import { LinkBuilder } from "./link-builder";
import styles from "../admin.module.css";

export default async function AdminLinksPage() {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Tagged links</h1>
          <p className={styles.sub}>Every link you post should carry UTM tags, so visits show up under the exact bio, reel or post in Traffic instead of &quot;direct&quot;. Pick a preset, fill in the content tag, copy.</p>
        </div>
      </div>
      <LinkBuilder />
    </main>
  );
}
