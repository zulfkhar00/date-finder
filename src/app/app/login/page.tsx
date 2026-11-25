import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { isOwner, ownerAllowlist } from "@/lib/app/owner";
import { getAppUser } from "@/lib/app/session";
import { OwnerLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function OwnerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (isOwner(await getAppUser(), ownerAllowlist())) redirect("/app");
  const { error } = await searchParams;
  return (
    <main className="app-auth">
      <div className="app-auth-card">
        <BrandMark className="app-auth-mark" />
        <h1 className="app-display">Welcome back.</h1>
        <p className="app-sub">Sign in with your email and password.</p>
        <OwnerLoginForm initialError={error === "link" ? "That link is invalid or has expired. Ask for a new one." : undefined} />
      </div>
    </main>
  );
}
