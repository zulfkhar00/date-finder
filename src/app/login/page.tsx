import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { getAppUser } from "@/lib/app/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAppUser()) redirect("/home");
  const { error } = await searchParams;
  return (
    <main className="app-auth">
      <div className="app-auth-card">
        <BrandMark className="app-auth-mark" />
        <h1 className="app-display">Welcome to NoSwipe.</h1>
        <p className="app-sub">Enter your email. We send you a code, and set up your account if you&rsquo;re new.</p>
        <LoginForm initialError={error === "link" ? "That sign-in link is invalid or has expired. Ask for a new one." : undefined} />
        <p className="app-fine">By continuing you agree to the <a href="/terms">terms</a> and <a href="/privacy">privacy note</a>. You must be 18 or older.</p>
      </div>
    </main>
  );
}
