import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ogImages } from "@/lib/og";

const description = "How NoSwipe uses your profile details and photos to create and run your dating profiles, chat as you, and how you can pause, take over or delete everything.";

export const metadata: Metadata = {
  title: "Privacy note",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { images: ogImages, title: "NoSwipe privacy note", description, url: "/privacy" },
  twitter: { images: ogImages, title: "NoSwipe privacy note", description }
};

export default function PrivacyPage() {
  return <div className="interior"><SiteHeader /><main className="shell doc"><div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}><p className="kicker">The details</p><h1>Privacy note.</h1></div>
<p>This note explains what NoSwipe collects, why, who sees it and how to delete it. NoSwipe creates and runs dating profiles for you on Tinder, Hinge and Bumble, and chats as you, so it handles personal and sensitive information. Please read it before you sign up.</p>
<h2>What we collect</h2>
<p><strong>Your account and profile.</strong> Your email address, first name, birthday, gender, who you want to meet, city, job, optional height, three interests, your type (age range, distance, what you are looking for, three dealbreakers), the dating apps you picked, your tone preference and your notification preference.</p>
<p><strong>Your photos.</strong> The 3 to 6 photos you upload.</p>
<p><strong>Your activity.</strong> The matches on your dating-app profiles (name, age, photo), the messages they send you, the messages sent as you, whether a chat is taken over, and the dates booked. People who write to you did not agree to be on NoSwipe; we keep their messages only to run your chats and show them to you.</p>
<p><strong>Your consent.</strong> The time you agreed to let NoSwipe create and run your profiles, and the exact wording you agreed to.</p>
<p><strong>Early access and payment.</strong> If you reserve early access we collect your city, dating preference, relationship goal, date frequency, confirmation that you are 18 or older, when you accepted the terms, your Stripe Checkout reference, payment status and queue position (used internally).</p>
<h2>How we use it</h2>
<p>We use your photos and profile details to create and run dating profiles for you on the apps you picked, and to chat as you in your voice: first person, in the tone you chose. Messages are sent as you, from your profile. You can take over any chat or pause any app at any time from the app, and while you have taken over a chat or paused an app, nothing is sent for you there. We also use your details to sign you in, to email you when a date is booked or a chat needs you (you can turn these emails off in Profile), to support you, and to understand which campaigns bring people in.</p>
<h2>Who can see it</h2>
<p>Only you, and the NoSwipe team members who set up and support your account. We use service providers that process data for us: Supabase (database and private photo storage), Vercel (hosting), Stripe (payments), Resend (email), Anthropic (AI), and PostHog and Sentry (analytics and error monitoring). We do not sell your data.</p>
<h2>Photos and storage</h2>
<p>Photos are stored in a private storage bucket that only you and our server can read; they are never public. We show them to you through short-lived links. Photos are used to create your dating profiles, which means they are uploaded to the dating apps you picked and are then governed by those apps&apos; own terms and privacy policies as well.</p>
<h2>AI processing</h2>
<p>To write your profile and your messages, we send your profile details, your photos where needed, and the text of the conversation to Anthropic, which provides the Claude AI model, over its commercial API. Anthropic processes them to return the text and, under its commercial terms, does not use them to train its models. We do not use your photos or messages to train AI models.</p>
<h2>Dating apps</h2>
<p>Dating apps have their own rules and may restrict automated or third-party use of accounts. Using NoSwipe may lead an app to limit or suspend a profile. We tell you this up front; it is a risk you accept when you give your consent.</p>
<h2>Keeping and deleting your data</h2>
<p>We keep your profile, photos, matches, messages and dates while your account is open. In Profile you can delete your account at any time: that removes your profile, photos, preferences, consent record, matches, messages and dates from NoSwipe, and signs you out. We keep payment records Stripe and the law require. Deleting your NoSwipe account does not delete a profile that already exists on a dating app; ask us to close it, or do it in that app. You can also email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
<h2>Cookies and campaign data</h2>
<p>We set a first-party cookie to keep you signed in. We also set <code>ns_attr</code> for 30 days, which remembers the campaign tags (UTM parameters), page variant and referring website (origin only) from your first visit, and we store those values with your reservation so we know which campaigns work.</p>
<h2>Analytics</h2>
<p>We use product analytics (PostHog) to count page visits and sign-up steps, and error monitoring (Sentry) to fix problems. Analytics stores a random first-party identifier in a cookie and in your browser&apos;s local storage. We do not record what you type into forms, we remove email addresses before monitoring data is sent, and analytics is switched off if your browser sends a Do Not Track signal. The signed-in app and the admin pages are not tracked.</p>
<h2>Payment information</h2>
<p>Checkout is hosted by Stripe. We do not receive or store your full card number. Stripe processes the $1 payment and any refund required by law or issued by us.</p>
<h2>Email</h2>
<p>We email you sign-in codes, a confirmation after your $1 payment, and, unless you turn it off, a note when a date is booked or a chat needs you. Notification emails contain the match&apos;s first name and a link, never the messages. They are sent through Resend, which receives your email address and the message only to deliver it.</p>
<h2>Questions and changes</h2>
<p>For questions or requests to access, correct or remove your information, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
<p className="policy-note">Last updated November 4, 2026.</p></main><SiteFooter /></div>;
}
