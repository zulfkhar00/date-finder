"use client";

// Browser-side store for the owner-only walkthrough (/app). Persists to localStorage so a refresh or a trip through
// the tabs keeps the state. Nothing here talks to a server: no Supabase, no email, no messages leave the browser.
import { useSyncExternalStore } from "react";
import { fireReply, parseStored, seed, type MockState } from "@/lib/app/mock-core";

const KEY = "ns-owner-preview-v1";
let state: MockState | null = null;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function persist(next: MockState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full (large uploaded photos) or blocked: keep what fits. Uploaded data: URLs go first.
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...next, photos: next.photos.filter((p) => !p.url?.startsWith("data:")) }));
    } catch { /* in-memory only for this tab */ }
  }
}

function load(): MockState {
  let stored: MockState | null = null;
  try { stored = parseStored(window.localStorage.getItem(KEY)); } catch { /* storage blocked */ }
  return stored ?? seed();
}

/** Schedules the scripted answer for every chat that is waiting on one. Overdue ones (after a refresh) land at once. */
function arm() {
  if (!state) return;
  for (const m of state.matches) {
    const key = `${m.id}@${m.pendingReplyAt}`;
    if (!m.pendingReplyAt) continue;
    if (timers.has(key)) continue;
    const wait = Math.max(0, Date.parse(m.pendingReplyAt) - Date.now());
    timers.set(key, setTimeout(() => { timers.delete(key); set((s) => fireReply(s, m.id)); }, wait));
  }
}

function snapshot(): MockState {
  if (state === null) { state = load(); queueMicrotask(arm); }
  return state;
}

export function set(update: (s: MockState) => MockState) {
  const next = update(snapshot());
  if (next === state) return;
  state = next;
  persist(next);
  arm();
  listeners.forEach((l) => l());
}

/** Replace everything (reset, replay onboarding, empty-state tour). */
export function replace(next: MockState) { set(() => next); }

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the preview: follow it.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    state = parseStored(e.newValue) ?? seed();
    listeners.forEach((l) => l());
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/** The preview state, or null on the server and until the browser has loaded it. */
export function useMock(): MockState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
