import { ArrowDown, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CtaLink } from "@/components/cta-link";
import { HeroPhone } from "@/components/hero-phone";
import { MatchCards } from "@/components/match-cards";
import { Faq } from "@/components/faq";
import { StickyCta } from "@/components/sticky-cta";
import { Testimonials } from "@/components/testimonials";
import { YourWeek } from "@/components/your-week";

const strip = ["Tinder", "Hinge", "Bumble", "Swipes for you", "Chats for you", "Books the date", "Your type only", "You just show up"];

const steps = [
  { title: "Tell us your type", body: "Your apps, your dealbreakers, who you actually want to meet. Takes two minutes." },
  { title: "We run your apps", body: "NoSwipe swipes on people who fit, opens with something better than \u201chey\u201d and keeps the chat going in your voice." },
  { title: "Show up to the date", body: "When it\u2019s a yes, the date gets booked and the plan lands in your messages: where, when, who." }
];

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="shell hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="sticker">Tinder · Bumble · Hinge</span>
            <h1 id="hero-title"><span className="line">Stop swiping.</span><span className="line">Start <span className="mark">dating.</span></span></h1>
            <p className="hero-sub">NoSwipe is AI that runs your Tinder, Hinge and Bumble. It swipes on people who actually fit, chats in your voice and books the date. <strong>You just show up.</strong></p>
            <div className="hero-cta" id="hero-cta">
              <CtaLink location="hero">Get started</CtaLink>
              <a href="/demo" className="hero-alt">See a demo <ArrowDown size={16} strokeWidth={2.5} /></a>
            </div>
          </div>
          <div className="hero-art">
            <span className="blob blob-a" aria-hidden="true" />
            <span className="blob blob-b" aria-hidden="true" />
            <span className="sticker float-sticker float-1" aria-hidden="true">we swipe</span>
            <span className="sticker float-sticker float-2" aria-hidden="true">you date</span>
            <HeroPhone />
          </div>
        </section>

        <div className="strip" aria-hidden="true">
          <div className="strip-track">{[...strip, ...strip].map((item, i) => <span key={i}>{item}</span>)}</div>
        </div>

        <section id="get" className="section shell" aria-labelledby="get-title">
          <p className="kicker">What you get</p>
          <h2 id="get-title" className="h2">Your profile. Your chats. <span className="mark">Your dates.</span></h2>
          <p className="lede">We set up your profiles, keep your chats going as you, and book the dates. You stay in control: pause an app or take over any chat in one tap.</p>
          <MatchCards />
        </section>

        <YourWeek />

        <section id="how" className="section shell" aria-labelledby="how-title" style={{ paddingTop: 0 }}>
          <p className="kicker">How it works</p>
          <h2 id="how-title" className="h2">Set it up once. <span className="mark">Keep control.</span></h2>
          <ol className="how-grid" style={{ listStyle: "none", padding: 0 }}>
            {steps.map((step, i) => (
              <li className="how-card" key={step.title}>
                <span className="how-step">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="promise">
            <ShieldCheck size={30} strokeWidth={2.2} aria-hidden="true" />
            <div>
              <strong>Your real photos. Your real voice.</strong>
              <p>We use your real photos and never create a fake version of you. You can pause any app or take over any chat at any time.</p>
            </div>
          </div>
        </section>

        <Testimonials />

        <Faq />

        <section className="section closing" aria-labelledby="closing-title">
          <div className="shell">
            <h2 id="closing-title">Your thumb deserves a break.</h2>
            <p>AI that swipes, chats and books dates for you on Tinder, Hinge and Bumble.</p>
            <CtaLink location="closing" className="btn btn-lime" />
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta watchId="hero-cta" />
    </>
  );
}
