import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { FunnelTracker } from "@/components/funnel-tracker";
import { getAppUser } from "@/lib/app/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAppUser()) redirect("/home");
  const { error } = await searchParams;
  return (
    <main className="app-auth">
      <FunnelTracker event="page_view" />
      <div className="app-auth-card">
        <BrandMark className="app-auth-mark" />
        <h1 className="app-display">Welcome to NoSwipe.</h1>
        <p className="app-sub">Sign in with your email.</p>
        <LoginForm initialError={error === "link" ? "That sign-in link is invalid or has expired. Ask for a new one." : undefined} />
        <p className="app-fine">18+ · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>
      </div>
    </main>
  );
}
