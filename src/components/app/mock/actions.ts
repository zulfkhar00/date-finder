"use client";

// What the preview's buttons call. Each one changes the browser-side store only, after a short pause so loading
// states show the way they do against the real server. Nothing leaves the browser.
import type { ThreadApi, ThreadDraftApi } from "@/components/app/thread";
import type { ProfileApi } from "@/components/app/profile-client";
import type { PhotoApi } from "@/components/app/photo-manager";
import { SAMPLE_PHOTOS, cancelDate, confirmDate, fresh, handBack, nextDraft, quiet, rateDate, requestDraft, saveSettings, saveStep, seed, sendMessage, setAppPaused, setPhotos, skipDraft, takeOver, type DateOutcome, type MockState } from "@/lib/app/mock-core";
import { replace, set } from "@/lib/app/mock-store";
import type { Photo } from "@/lib/app/data";
import { signOutOwner } from "@/app/app/login/actions";

type R = { ok: true } | { ok: false; error: string };
const pause = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const OK: R = { ok: true };

/** Run a state change that can be refused; hands the refusal back as the error the screens already show. */
async function attempt(fn: (s: MockState) => { state: MockState; error?: string }): Promise<R> {
  await pause();
  let error: string | undefined;
  set((s) => { const r = fn(s); error = r.error; return r.state; });
  return error ? { ok: false, error } : OK;
}
async function apply(fn: (s: MockState) => MockState): Promise<R> {
  await pause();
  set(fn);
  return OK;
}

export const threadApi: ThreadApi = {
  takeOver: (id) => apply((s) => takeOver(s, id)),
  handBack: (id) => apply((s) => handBack(s, id)),
  send: (id, body) => attempt((s) => sendMessage(s, id, body))
};
export const draftApi: ThreadDraftApi = {
  send: (id, body) => attempt((s) => sendMessage(s, id, body)),
  retake: (id) => apply((s) => nextDraft(s, id)),
  skip: (id) => apply((s) => skipDraft(s, id)),
  request: (id) => apply((s) => requestDraft(s, id))
};

export const dateApi = {
  confirm: (id: string, slot?: string) => apply((s) => confirmDate(s, id, slot)),
  cancel: (id: string) => apply((s) => cancelDate(s, id)),
  rate: (id: string, outcome: DateOutcome) => apply((s) => rateDate(s, id, outcome))
};

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}
/** Photos stay in this browser: removing, reordering and adding only touch the preview store. */
export const photoApi: PhotoApi = {
  remove: (id) => apply((s) => setPhotos(s, s.photos.filter((p) => p.id !== id))),
  reorder: (ids) => apply((s) => setPhotos(s, ids.map((id) => s.photos.find((p) => p.id === id)).filter((p): p is Photo => Boolean(p)))),
  async upload(blob) {
    const url = await readAsDataUrl(blob);
    const photo: Photo = { id: `up-${Date.now().toString(36)}`, path: "preview", position: 0, url };
    await apply((s) => setPhotos(s, [...s.photos, photo]));
    return photo;
  }
};
export const addSamplePhotos = () => set((s) => setPhotos(s, [...s.photos, ...SAMPLE_PHOTOS.filter((p) => !s.photos.some((x) => x.id === p.id))].slice(0, 6)));

export const profileApi = (restart: () => void): ProfileApi => ({
  saveStep: (step, payload) => attempt((s) => saveStep(s, step, payload)),
  setAppPaused: (app, paused) => apply((s) => setAppPaused(s, app, paused)),
  saveSettings: ({ voice, notifyEmail }) => apply((s) => saveSettings(s, voice, notifyEmail)),
  // "Delete account" wipes the preview data and starts again from onboarding, as a brand new person would.
  deleteAccount: async () => { await pause(); replace(fresh()); restart(); return OK; },
  signOut: signOutOwner,
  photos: photoApi
});

export const previewTools = {
  resetSample: () => replace(seed()),
  emptyStates: () => replace(quiet()),
  replayOnboarding: () => replace(fresh())
};
