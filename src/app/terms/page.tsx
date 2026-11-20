import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ogImages } from "@/lib/og";

const description = "Terms for the NoSwipe service that creates and runs your dating profiles and chats as you, and for the refundable $1 early-access reservation.";

export const metadata: Metadata = {
  title: "Terms",
  description,
  alternates: { canonical: "/terms" },
  openGraph: { images: ogImages, title: "NoSwipe terms", description, url: "/terms" },
  twitter: { images: ogImages, title: "NoSwipe terms", description }
};

export default function TermsPage() {
  return <div className="interior">
    <SiteHeader />
    <main className="shell doc">
      <div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <p className="kicker">The details</p>
        <h1>Terms.</h1>
      </div>
      <p>NoSwipe creates and runs dating profiles for you on the apps you pick (Tinder, Hinge and Bumble), swipes on people who fit your type, chats as you and books dates. You must be 18 or older.</p>
      <h2>Your permission</h2>
      <p>Before NoSwipe starts, you give explicit consent: NoSwipe creates and runs dating profiles for you on the apps you picked, using the photos you provide, and chats as you. Messages are sent as you, in the first person, from the profile we run for you. You confirm that the photos are of you and that the details you give are true. You can pause any app or take over any chat at any time from the app, and you can withdraw your consent and delete your account at any time.</p>
      <h2>Dating-app rules and risk</h2>
      <p>The dating apps have their own terms, and some limit automated or third-party use of accounts. An app may limit, suspend or remove a profile that NoSwipe runs. NoSwipe cannot control that, and you accept the risk when you consent. Profiles we create stay in the dating apps until you or we close them.</p>
      <h2>Your $1 early-access payment</h2>
      <p>The one-time USD $1 charge is a refundable early-access waitlist fee. It reserves a spot on the list; it does not start the service, buy any number of matches or dates, or change anything about how your profile is run. Your spot is confirmed after our Stripe webhook verifies payment. We show you the price and separate terms for any paid service before you decide whether to join it.</p>
      <h2 id="prohibited-conduct-and-safety">Prohibited conduct and safety</h2>
      <p>NoSwipe is for adults only: you must be 18 or older, and we do not serve anyone under 18. You may not use NoSwipe for, or to support:</p>
      <ul>
        <li>human trafficking, including sexual exploitation of any person;</li>
        <li>prostitution, or soliciting or advertising escort or other commercial sex services;</li>
        <li>any sexual content involving minors, or any contact with a minor;</li>
        <li>aiding, abetting or encouraging abuse of another person;</li>
        <li>harassment, stalking, threats or violence;</li>
        <li>fraud or scams, including romance scams; or</li>
        <li>impersonation, fake identities or using someone else&apos;s photos.</li>
      </ul>
      <p>If we find or reasonably suspect a violation, we may suspend or terminate your account and the profiles we run for you, with or without notice. We report suspected trafficking, child sexual exploitation and other serious crimes to the authorities, including the National Center for Missing &amp; Exploited Children (NCMEC), and cooperate under our <Link href="/law-enforcement">law enforcement protocol</Link>. The full rules are in our <Link href="/acceptable-use">Acceptable use policy</Link>. To report a violation, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
      <h2>What we do not promise</h2>
      <p>NoSwipe cannot guarantee a match, reply, date or relationship, or that a dating app keeps a profile active. Chats are written by software; you can read every one, and you are responsible for taking over any chat where you want to say something in your own words. Do not use NoSwipe to deceive, harass or pressure anyone.</p>
      <h2>Refund policy</h2>
      <p>The $1 is refundable. Reply to your confirmation email or write to support@noswipe.app and we refund it to your original payment method; your spot is then no longer reserved.</p>
      <h2>Eligibility and contact</h2>
      <p>You must be 18 or older to sign up. Keep your sign-in codes and confirmation link private. For questions, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
      <p className="policy-note">Last updated November 20, 2026. Please also read our <Link href="/privacy">privacy note</Link>, <Link href="/acceptable-use">Acceptable use policy</Link>, <Link href="/refunds">refund policy</Link> and <Link href="/pricing">pricing</Link>.</p>
    </main>
    <SiteFooter />
  </div>;
}
