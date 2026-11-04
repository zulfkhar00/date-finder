import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { Failure } from "./core";

/** Bearer-token check against AUTOMATION_API_KEY (server env only). Returns the service client or an error response. */
export function authorizeAutomation(request: Request) {
  const expected = process.env.AUTOMATION_API_KEY?.trim();
  if (!expected || expected.length < 32) return { error: json({ ok: false, code: "unconfigured", message: "Automation API is not enabled." }, 503) };
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const enc = new TextEncoder();
  const a = enc.encode(token), b = enc.encode(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: json({ ok: false, code: "unauthorized", message: "Missing or wrong key." }, 401) };
  try {
    return { sb: getSupabaseAdmin() };
  } catch {
    return { error: json({ ok: false, code: "unconfigured", message: "Database is not configured." }, 503) };
  }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function respond<T extends { ok: boolean }>(result: T | Failure) {
  if (result.ok) return json(result);
  const f = result as Failure;
  return json({ ok: false, code: f.code, message: f.message }, f.status);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > 20000) return undefined;
    return text ? JSON.parse(text) : {};
  } catch {
    return undefined;
  }
}
