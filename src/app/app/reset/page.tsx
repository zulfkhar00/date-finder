import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { isOwner, ownerAllowlist } from "@/lib/app/owner";
import { getAppUser } from "@/lib/app/session";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "New password", robots: { index: false, follow: false } };

export default async function ResetPage() {
  if (!isOwner(await getAppUser(), ownerAllowlist())) redirect("/app/login");
  return (
    <main className="app-auth">
      <div className="app-auth-card">
        <BrandMark className="app-auth-mark" />
        <h1 className="app-display">New password.</h1>
        <p className="app-sub">Choose a password you don&rsquo;t use anywhere else.</p>
        <ResetForm />
      </div>
    </main>
  );
}
