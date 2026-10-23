import { redirect } from "next/navigation";
import { getAdminState } from "../_lib/auth";
import { SetupNotice } from "../_components/notices";
import { LoginForm } from "./login-form";
import styles from "../admin.module.css";

const ERRORS: Record<string, string> = {
  link: "That sign-in link is invalid, expired, or was opened in a different browser. Request a new one, or use the code from the email."
};

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = await getAdminState();
  if (state.kind === "unconfigured") return <SetupNotice missing={state.missing} />;
  if (state.kind === "admin") redirect("/admin");

  const errorKey = (await searchParams).error;
  return (
    <div className={styles.authWrap}>
      <div className={styles.authCard}>
        <div>
          <h1>Sign in</h1>
          <p className={styles.sub}>Founders only. We email you a one-time link and code.</p>
        </div>
        <LoginForm initialError={typeof errorKey === "string" ? ERRORS[errorKey] : undefined} />
      </div>
    </div>
  );
}
