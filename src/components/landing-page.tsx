import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CountryNotice } from "@/components/country-notice";
import { CtaLink } from "@/components/cta-link";
import { HeroPhone } from "@/components/hero-phone";
import { MatchCards } from "@/components/match-cards";
import { StickyCta } from "@/components/sticky-cta";
import { Testimonials } from "@/components/testimonials";
import { YourWeek } from "@/components/your-week";
import { Acc, FaqItems } from "@/components/short/parts";
import { HowSteps } from "@/components/short/how-steps";
import { faqs } from "@/content/faq";

const strip = ["Tinder", "Hinge", "Bumble", "Swipes for you", "Chats for you", "Books the date", "Your type only", "You just show up"];

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="shell hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title"><span className="line">Skip the swipe.</span><span className="line">Make <span className="mark">plans.</span></span></h1>
            <p className="hero-sub">A dating concierge for Hinge, Tinder and Bumble. We handle swiping, chats and date plans. <strong>You just show up.</strong></p>
            <div className="hero-cta" id="hero-cta">
              <CtaLink location="hero">Get started</CtaLink>
              <a className="btn btn-white" href="/demo">Try the interactive demo</a>
              <CountryNotice />
              <p className="fine">Explore sample matches and date plans, and try taking over a chat. No signup needed for the demo.</p>
            </div>
          </div>
          <div className="hero-art">
            <span className="blob blob-a" aria-hidden="true" />
            <span className="blob blob-b" aria-hidden="true" />
            <HeroPhone />
          </div>
        </section>

        <div className="strip" aria-hidden="true">
          <div className="strip-track">{[...strip, ...strip].map((item, i) => <span key={i}>{item}</span>)}</div>
        </div>

        <HowSteps />

        <div className="shell short-more">
          <Acc title="What you get" id="get">
            <p>We set up your profiles, keep your chats going as you, and book the dates. Pause an app or take over any chat in one tap.</p>
            <MatchCards />
          </Acc>
          <Acc title="Inside the app" id="app">
            <YourWeek />
          </Acc>
          <Acc title="Your real photos, your real voice">
            <div className="promise">
              <ShieldCheck size={30} strokeWidth={2.2} aria-hidden="true" />
              <div>
                <strong>Your real photos. Your real voice.</strong>
                <p>We use your real photos and never create a fake version of you. You can pause any app or take over any chat at any time.</p>
              </div>
            </div>
          </Acc>
          <Acc title="FAQ" id="faq" className="guide-faq">
            <FaqItems faqs={faqs.map((item) => ({ question: item.q, answer: item.a }))} />
          </Acc>
        </div>

        <nav className="shell related-guides" aria-label="Dating apps done for you">
          <p className="kicker">Dating apps, done for you</p>
          <div>
            <Link href="/someone-to-run-my-dating-apps">Someone to run my dating apps</Link>
            <Link href="/tinder-done-for-you">Tinder done for you</Link>
            <Link href="/hinge-done-for-you">Hinge done for you</Link>
            <Link href="/bumble-done-for-you">Bumble done for you</Link>
            <Link href="/too-busy-for-dating-apps">Too busy for dating apps?</Link>
            <Link href="/dating-app-management-service">Dating app management service</Link>
          </div>
        </nav>

        <Testimonials />

        <section className="section closing" aria-labelledby="closing-title">
          <div className="shell">
            <h2 id="closing-title">Your thumb deserves a break.</h2>
            <CtaLink location="closing" className="btn btn-lime" />
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta watchId="hero-cta" />
    </>
  );
}
