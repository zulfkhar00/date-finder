"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export type CopyItem = { label: string; text: string };

/** Tappable example cards. The whole card copies; the text is real HTML so crawlers read it. */
export function CopyCards({ items, title = "Copy and use" }: { items: CopyItem[]; title?: string }) {
  const [copied, setCopied] = useState<number | null>(null);
  if (items.length === 0) return null;

  async function copy(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); } catch { /* clipboard unavailable */ }
      area.remove();
    }
    setCopied(index);
    window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 1600);
  }

  return (
    <section className="shell short-copy" aria-labelledby="copy-title">
      <h2 id="copy-title" className="short-h2">{title}</h2>
      <ul className="copy-list">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            <button type="button" className="copy-card" data-done={copied === i} onClick={() => void copy(i, item.text)}>
              <span className="copy-label">{item.label}</span>
              <span className="copy-text">{item.text}</span>
              <span className="copy-btn" aria-live="polite">
                {copied === i ? <><Check size={16} strokeWidth={3} aria-hidden="true" /> Copied</> : <><Copy size={16} strokeWidth={2.6} aria-hidden="true" /> Copy</>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
