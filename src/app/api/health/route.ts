import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type CheckResult = "ok" | "error" | "timeout" | "unconfigured";

const SUPABASE_TIMEOUT_MS = 2000;

async function checkSupabase(): Promise<CheckResult> {
  if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)) return "unconfigured";
  const signal = AbortSignal.timeout(SUPABASE_TIMEOUT_MS);
  try {
    const { error } = await getSupabaseAdmin().from("reservations").select("id").limit(1).abortSignal(signal);
    if (signal.aborted) return "timeout";
    return error ? "error" : "ok";
  } catch {
    return signal.aborted ? "timeout" : "error";
  }
}

// Liveness + dependency check. Reports status words only: no error messages, hosts or keys.
export async function GET() {
  const supabase = await checkSupabase();
  const ok = supabase === "ok";
  return Response.json(
    { ok, version: process.env.GIT_SHA || null, time: new Date().toISOString(), checks: { supabase } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
