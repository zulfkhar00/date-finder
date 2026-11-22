import { adminEmailOrNull } from "@/lib/admin-auth";
import { buildPhotoZip } from "@/lib/operator/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All of a client's kit photos, in kit order, as one zip for the operator to upload from the phone. Admin only. Built in memory from the
// private bucket and streamed back: nothing is stored, no names or contents are logged.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await adminEmailOrNull())) return new Response("Not authorized", { status: 401 });
  const { id } = await params;
  const app = new URL(request.url).searchParams.get("app") ?? "";
  const result = await buildPhotoZip(getSupabaseAdmin(), id, app);
  if (!result.ok) return new Response(result.message, { status: result.status, headers: { "Cache-Control": "no-store" } });
  return new Response(new Blob([result.zip as BlobPart], { type: "application/zip" }), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="kit-${app}-photos.zip"`, "Cache-Control": "no-store" }
  });
}
