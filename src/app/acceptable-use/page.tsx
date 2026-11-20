import Link from "next/link";
import { DocPage, SUPPORT_EMAIL, docMetadata } from "@/components/doc-page";

export const metadata = docMetadata("/acceptable-use", "Acceptable use policy", "NoSwipe acceptable use policy",
  "What you may and may not do with NoSwipe, the AI dating assistant that swipes, chats and schedules dates for you: no trafficking, no commercial sex, no minors, no harassment, no fake identities.");

export default function AcceptableUsePage() {
  return <DocPage heading="Acceptable use policy.">
    <p>NoSwipe is an AI dating assistant: it swipes, chats and schedules dates for you, as you, on the dating apps you pick. This policy says what you and the service may and may not do. It is part of our <Link href="/terms">Terms</Link>.</p>
    <h2>Who may use NoSwipe</h2>
    <p>You must be 18 or older. We do not knowingly serve anyone under 18, and we close any account we learn belongs to a minor. Only use photos of yourself and details that are true.</p>
    <h2>What you may not do</h2>
    <ul>
      <li>Use NoSwipe for human trafficking or sexual exploitation of any person, or to recruit, advertise, transport or control a victim.</li>
      <li>Use NoSwipe for prostitution or escort services, or to offer, solicit or arrange sex for money or anything of value.</li>
      <li>Create, share, request or discuss sexual content involving anyone under 18, or contact or groom a minor in any way.</li>
      <li>Aid, abet, encourage or threaten abuse of another person, whether sexual, physical, emotional or financial.</li>
      <li>Harass, stalk, threaten, pressure or send unwanted sexual content to the people you match with, or use the service to be violent toward anyone.</li>
      <li>Run scams, romance fraud or any attempt to get money, gifts or personal data from a match by deceit.</li>
      <li>Pretend to be someone else, use another person&apos;s photos, or build a fake identity (catfishing).</li>
      <li>Scrape or copy data about other people from NoSwipe or from dating apps, or resell it.</li>
      <li>Use NoSwipe to break the law, or to attack, overload or probe our systems.</li>
    </ul>
    <h2>Your own dating-app accounts</h2>
    <p>NoSwipe only works on profiles that belong to you, for you, with your explicit consent. You may not give us access to, or ask us to run, an account that belongs to someone else. You can pause any app or take over any chat at any time, and withdraw your consent by deleting your account. Dating apps have their own rules; you are responsible for following them.</p>
    <h2>How NoSwipe handles messages</h2>
    <p>Messages are written by software in your voice and sent as you. You are responsible for what is sent from your profile. We may block or stop messages that appear to break this policy.</p>
    <h2>What happens if you break this policy</h2>
    <p>We may pause or end your service, close the profiles we run for you and delete your account, without notice where the risk is serious. Any payment is refunded only as set out in the <Link href="/refunds">refund policy</Link>. Where the law requires it, or where we believe someone is in danger, we report conduct to the authorities and cooperate under our <Link href="/law-enforcement">law enforcement protocol</Link>. Reports of child sexual exploitation go to the National Center for Missing &amp; Exploited Children (NCMEC).</p>
    <h2>Report a violation</h2>
    <p>If you see or experience conduct that breaks this policy, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with what happened and, if you can, the profile or chat involved. We review reports and act on them. If someone is in immediate danger, call your local emergency number first.</p>
    <p className="policy-note">Last updated November 20, 2026. See also our <Link href="/terms">Terms</Link> and <Link href="/privacy">privacy note</Link>.</p>
  </DocPage>;
}
