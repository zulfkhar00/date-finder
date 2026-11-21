"use client";

import { useMemo, useState } from "react";
import { buildUtmLink, LANDING_CHOICES, LINK_PRESETS } from "@/lib/utm-links";
import styles from "../admin.module.css";

/** Builds a tagged noswipe.app link from a preset. Nothing is stored or sent; it only formats a URL. */
export function LinkBuilder() {
  const [preset, setPreset] = useState(LINK_PRESETS[0].id);
  const first = LINK_PRESETS[0];
  const [path, setPath] = useState<string>("/");
  const [source, setSource] = useState(first.source);
  const [medium, setMedium] = useState(first.medium);
  const [campaign, setCampaign] = useState(first.campaign);
  const [content, setContent] = useState("");
  const [copy, setCopy] = useState<"idle" | "copying" | "copied" | "failed">("idle");

  const hint = LINK_PRESETS.find((p) => p.id === preset)?.contentHint;
  const result = useMemo(() => buildUtmLink({ path, source, medium, campaign, content }), [path, source, medium, campaign, content]);

  function choose(id: string) {
    const p = LINK_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setSource(p.source);
    setMedium(p.medium);
    setCampaign(p.campaign);
    setContent("");
    setCopy("idle");
  }

  async function copyLink() {
    if (!result.ok || copy === "copying") return;
    setCopy("copying");
    try {
      await navigator.clipboard.writeText(result.url);
      setCopy("copied");
      setTimeout(() => setCopy("idle"), 2000);
    } catch {
      setCopy("failed");
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.chips} role="group" aria-label="Link presets">
        {LINK_PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => choose(p.id)} aria-pressed={p.id === preset} className={`${styles.chip} ${p.id === preset ? "" : styles.chipAlt}`} style={{ cursor: "pointer" }}>
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.linkForm}>
        <label className={styles.field}>Landing page
          <select className={styles.select} value={path} onChange={(e) => setPath(e.target.value)}>
            {LANDING_CHOICES.map((c) => <option key={c.path} value={c.path}>{c.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>Source (utm_source)
          <input className={styles.input} value={source} onChange={(e) => setSource(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </label>
        <label className={styles.field}>Medium (utm_medium)
          <input className={styles.input} value={medium} onChange={(e) => setMedium(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </label>
        <label className={styles.field}>Campaign (utm_campaign)
          <input className={styles.input} value={campaign} onChange={(e) => setCampaign(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </label>
        <label className={styles.field}>Content (utm_content){hint ? ` — ${hint}` : ""}
          <input className={styles.input} value={content} onChange={(e) => setContent(e.target.value)} autoCapitalize="none" spellCheck={false} placeholder="optional" />
        </label>
      </div>

      {result.ok ? (
        <>
          <p className={styles.linkOut} aria-live="polite" data-testid="utm-link">{result.url}</p>
          <button type="button" className={styles.button} onClick={copyLink} disabled={copy === "copying"} aria-busy={copy === "copying"}>
            {copy === "copying" ? <span className={styles.spinner} aria-hidden /> : null}
            {copy === "copying" ? "Copying…" : copy === "copied" ? "Copied" : copy === "failed" ? "Copy failed, select the link and copy" : "Copy link"}
          </button>
        </>
      ) : (
        <p className={styles.sub} role="alert">{result.error}</p>
      )}
      <p className={styles.sub}>Values are lowercased and cleaned (letters, numbers, - _ .). Use the same source names as Traffic shows: instagram, tiktok, producthunt, reddit, x, threads.</p>
    </section>
  );
}
