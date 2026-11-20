"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { removePhoto, reorderPhotos } from "@/lib/app/actions";
import { PHOTO_MAX } from "@/lib/app/domain";
import type { Photo } from "@/lib/app/data";
import { USER_FLAG_NOTICE } from "@/lib/starter-pack/photo-flags-core";
import { PHOTO_NETWORK_ERROR as NETWORK_ERROR, uploadErrorMessage, withTimeout } from "@/lib/app/photo-errors";

/** Shrinks a photo in the browser (max 1600 px, JPEG) so uploads stay small and fast. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("encode");
  return blob;
}

type R = { ok: true } | { ok: false; error: string };
export type PhotoApi = {
  remove: (id: string) => Promise<R>;
  reorder: (ids: string[]) => Promise<R>;
  upload: (blob: Blob) => Promise<Photo>;
};
/** Real photo operations: private bucket through /api/app/photos and the server actions. */
export const realPhotoApi: PhotoApi = {
  remove: removePhoto,
  reorder: reorderPhotos,
  async upload(blob) {
    const form = new FormData();
    form.append("file", blob, "photo.jpg");
    const res = await fetch("/api/app/photos", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Upload failed.");
    return json.photo as Photo;
  }
};

export function PhotoManager({ initial, flaggedIds = [], onChange, onBusyChange, api = realPhotoApi }: { initial: Photo[]; flaggedIds?: string[]; onChange?: (photos: Photo[]) => void; onBusyChange?: (busy: boolean) => void; api?: PhotoApi }) {
  const [photos, setPhotos] = useState(initial);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // Photos held for review: the user is told one neutral line and can replace the photo. Removing one clears it from here at once.
  const flagged = photos.filter((p) => flaggedIds.includes(p.id));

  // Tell the parent while something is in flight so "Continue" waits for it instead of leaving mid-upload.
  const lock = (value: string) => { setBusy(value); onBusyChange?.(value !== ""); };
  const apply = (next: Photo[]) => { setPhotos(next); onChange?.(next); };

  async function add(files: FileList | null) {
    if (!files?.length || busy) return;
    setError("");
    let current = photos;
    for (const file of Array.from(files).slice(0, PHOTO_MAX - photos.length)) {
      lock("upload");
      try {
        const blob = await shrink(file);
        current = [...current, await api.upload(blob)];
        apply(current);
      } catch (cause) {
        setError(uploadErrorMessage(cause));
        break;
      }
    }
    lock("");
    if (input.current) input.current.value = "";
  }

  async function remove(id: string) {
    if (busy) return;
    lock(id); setError("");
    try {
      const r = await withTimeout(api.remove(id));
      if (r.ok) apply(photos.filter((p) => p.id !== id)); else setError(r.error);
    } catch { setError(NETWORK_ERROR); }
    lock("");
  }

  async function move(index: number, dir: -1 | 1) {
    if (busy) return;
    const next = [...photos];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    lock("move"); setError("");
    try {
      const r = await withTimeout(api.reorder(next.map((p) => p.id)));
      if (r.ok) apply(next); else setError(r.error);
    } catch { setError(NETWORK_ERROR); }
    lock("");
  }

  return (
    <div>
      <div className="ob-photos">
        {photos.map((p, i) => (
          <div className="ob-photo" key={p.id} data-flagged={flaggedIds.includes(p.id) ? "true" : undefined}>
            {p.url ? <img src={p.url} alt={`Your photo ${i + 1}`} /> : null}
            <span className="num">{i === 0 ? "Main" : i + 1}</span>
            <div className="tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || !!busy} aria-label={`Move photo ${i + 1} earlier`}><ArrowLeft size={18} /></button>
              <button type="button" onClick={() => remove(p.id)} disabled={!!busy} aria-label={`Remove photo ${i + 1}`}>{busy === p.id ? <span className="app-spinner" aria-hidden /> : <Trash2 size={18} />}</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1 || !!busy} aria-label={`Move photo ${i + 1} later`}><ArrowRight size={18} /></button>
            </div>
          </div>
        ))}
        {photos.length < PHOTO_MAX ? (
          <button type="button" className="ob-photo add" onClick={() => input.current?.click()} disabled={!!busy} aria-busy={busy === "upload"}>
            <span>{busy === "upload" ? <span className="app-spinner" aria-hidden /> : <ImagePlus size={26} aria-hidden />}<br />{busy === "upload" ? "Uploading" : "Add photo"}</span>
          </button>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void add(e.target.files)} aria-label="Choose photos" />
      <p className="app-fine">{photos.length} of {PHOTO_MAX} · 3 or more works best. Your first photo is your main one. Real photos of you only.</p>
      {flagged.length ? <p className="app-error" role="status" data-testid="photo-flag-notice">{USER_FLAG_NOTICE}</p> : null}
      {error ? <p className="app-error" role="alert">{error}</p> : null}
    </div>
  );
}
