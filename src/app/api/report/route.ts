import { NextResponse } from "next/server";
import { LIMITS, newReference, parseReportForm } from "@/lib/reports/core";
import { hashIp, submitReport } from "@/lib/reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST multipart: the public report form. No account, no CAPTCHA service. Defences: a hidden honeypot field (a filled one gets
// a believable success and is dropped), per-address and global rate limits in the database, strict size/type checks on the
// optional image. Nothing from the body is logged. No email is sent to the reporter.

const MAX_BODY = LIMITS.upload + 200_000;
const noStore = { "Cache-Control": "no-store" };

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim();
  return ip && ip.length <= 64 ? ip : null;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return NextResponse.json({ error: "The image is too large. Use one under 4 MB." }, { status: 413, headers: noStore });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That didn't send. Check your connection and try again." }, { status: 400, headers: noStore });
  }

  const parsed = parseReportForm((name) => {
    const v = form.get(name);
    return typeof v === "string" ? v : null;
  });
  if (!parsed.ok) return NextResponse.json({ error: "Please fix the highlighted fields.", fields: parsed.errors }, { status: 422, headers: noStore });
  // A bot that filled the hidden field sees a normal confirmation; nothing is stored, nobody is alerted.
  if (parsed.input.honeypot) return NextResponse.json({ ref: newReference() }, { headers: noStore });

  let bytes: Uint8Array | null = null;
  const file = form.get("attachment");
  if (file instanceof File && file.size > 0) {
    if (file.size > LIMITS.upload) return NextResponse.json({ error: "The image is too large. Use one under 4 MB.", fields: { attachment: "Too large" } }, { status: 413, headers: noStore });
    bytes = new Uint8Array(await file.arrayBuffer());
  }

  const ip = clientIp(request);
  let result;
  try {
    result = await submitReport(parsed.input, bytes, ip ? hashIp(ip) : null);
  } catch (error) {
    console.error("Report submit failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Something went wrong and your report was not saved. Please try again, or email support@noswipe.app." }, { status: 500, headers: noStore });
  }
  if (result.ok) return NextResponse.json({ ref: result.ref }, { headers: noStore });
  const status = result.code === "rate" ? 429 : result.code === "busy" || result.code === "unavailable" ? 503 : result.code === "upload" ? 422 : 500;
  return NextResponse.json({ error: result.error, ...(result.code === "upload" ? { fields: { attachment: result.error } } : {}) }, { status, headers: noStore });
}
