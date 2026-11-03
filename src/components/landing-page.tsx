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

const strip = ["Tinder", "Bumble", "Hinge", "Photo review", "Profile copy", "Message drafts", "First-date plans", "You stay in control"];

const steps = [
  { title: "Tell us what you need", body: "Share your goals, the apps you use and only the photos or screenshots you want reviewed." },
  { title: "Get tailored drafts", body: "NoSwipe prepares profile copy, photo feedback, openers, replies and first-date plans from that context." },
  { title: "Choose what to use", body: "You keep every account, choose who to like, edit the drafts and send every message yourself." }
];

export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="shell hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="sticker">Tinder · Bumble · Hinge</span>
            <h1 id="hero-title"><span className="line">Your AI dating assistant.</span><span className="line">Better <span className="mark">profiles and drafts.</span></span></h1>
            <p className="hero-sub">NoSwipe turns the context you share into profile suggestions, openers, replies and first-date plans. <strong>You keep your accounts, choose who to like and send every message yourself.</strong></p>
            <div className="hero-cta" id="hero-cta">
              <CtaLink href="/try" location="hero">Try it free</CtaLink>
              <a href="#get" className="hero-alt">See what you get <ArrowDown size={16} strokeWidth={2.5} /></a>
            </div>
          </div>
          <div className="hero-art">
            <span className="blob blob-a" aria-hidden="true" />
            <span className="blob blob-b" aria-hidden="true" />
            <span className="sticker float-sticker float-1" aria-hidden="true">screenshots in</span>
            <span className="sticker float-sticker float-2" aria-hidden="true">drafts out</span>
            <HeroPhone />
          </div>
        </section>

        <div className="strip" aria-hidden="true">
          <div className="strip-track">{[...strip, ...strip].map((item, i) => <span key={i}>{item}</span>)}</div>
        </div>

        <section id="get" className="section shell" aria-labelledby="get-title">
          <p className="kicker">What you get</p>
          <h2 id="get-title" className="h2">A practical dating copilot. <span className="mark">That’s it.</span></h2>
          <p className="lede">Useful drafts built from your real profile and conversations—not copied lines, fake photos or access to your dating-app accounts.</p>
          <MatchCards />
        </section>

        <YourWeek />

        <section id="how" className="section shell" aria-labelledby="how-title" style={{ paddingTop: 0 }}>
          <p className="kicker">How it works</p>
          <h2 id="how-title" className="h2">Share the context. <span className="mark">Keep control.</span></h2>
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
              <p>We can rank photos and suggest edits, but never create a fake version of you. Every profile change, like, message and date confirmation stays yours.</p>
            </div>
          </div>
        </section>

        <Testimonials />

        <Faq />

        <section className="section closing" aria-labelledby="closing-title">
          <div className="shell">
            <h2 id="closing-title">Keep the account. Get better drafts.</h2>
            <p>Screenshot-based profile, message and first-date planning help. You keep every account.</p>
            <CtaLink location="closing" className="btn btn-lime" />
          </div>
        </section>
      </main>
      <SiteFooter />
      <StickyCta watchId="hero-cta" />
    </>
  );
}
