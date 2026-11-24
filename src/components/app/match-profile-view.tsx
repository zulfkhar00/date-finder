import Link from "next/link";
import { Briefcase, ChevronLeft, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { Ago } from "@/components/app/ago";
import { AppChip } from "@/components/app/ui";
import { When } from "@/components/app/when";
import { APP_LABELS } from "@/lib/app/domain";
import { matchedVia, type MatchProfile } from "@/lib/app/match-profile";
import type { MatchRow } from "@/lib/app/data";

/**
 * A match's profile as the dating app shows it: photos to swipe through, name and age, how and when you matched, distance, bio, and the
 * app's own extras (Hinge prompts, Bumble question badges, Tinder passions). Presentational; the page signs the photo URLs.
 */
export function MatchProfileView({ match, profile, photoUrls, base = "" }: { match: Pick<MatchRow, "id" | "name" | "age" | "app" | "matched_at">; profile: MatchProfile; photoUrls: string[]; base?: string }) {
  return (
    <>
      <Link href={`${base}/chats/${match.id}`} className="app-link" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", marginLeft: -6 }}><ChevronLeft size={20} aria-hidden /> Chat</Link>
      {photoUrls.length ? (
        <div className="mp-photos" role="group" aria-label={`${match.name}'s photos`} tabIndex={0}>
          {photoUrls.map((url, i) => <img key={url} src={url} alt={`${match.name}, photo ${i + 1} of ${photoUrls.length}`} loading={i === 0 ? "eager" : "lazy"} />)}
        </div>
      ) : null}
      {photoUrls.length > 1 ? <div className="mp-dots" aria-hidden>{photoUrls.map((u) => <i key={u} />)}</div> : null}

      <div className="mp-head">
        <h1>{match.name}{match.age ? `, ${match.age}` : ""}</h1>
        <div className="mp-meta">
          <AppChip app={match.app} />
          <span><Ago iso={match.matched_at} prefix="Matched " /></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={15} aria-hidden />{profile.distanceKm} km away</span>
          {profile.job ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Briefcase size={15} aria-hidden />{profile.job}</span> : null}
        </div>
      </div>

      <div className="mp-card">
        <small>How you matched</small>
        <p style={{ fontSize: 16 }}>{matchedVia(match.app)} on {APP_LABELS[match.app]} · <When iso={match.matched_at} style="short" /></p>
      </div>
      <div className="mp-card"><small>About</small><p>{profile.bio}</p></div>
      {profile.prompts.map((p) => <div key={p.q} className="mp-card"><small>{p.q}</small><p>{p.a}</p></div>)}
      {profile.passions.length ? (
        <div className="mp-card"><small style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Sparkles size={14} aria-hidden /> Passions</small><div className="mp-chips">{profile.passions.map((x) => <span key={x}>{x}</span>)}</div></div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        <Link href={`${base}/chats/${match.id}`} className="app-btn"><MessageCircle size={18} aria-hidden /> Open the chat</Link>
      </div>
    </>
  );
}
