// Serves the Google Search Console HTML verification file. The file name comes from the
// GOOGLE_VERIFICATION_FILE env var (for example "google0123456789abcdef.html"); it is not a
// secret, but it differs per property, so it lives in env instead of in Git.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const expected = process.env.GOOGLE_VERIFICATION_FILE?.trim();
  if (!expected || file !== expected) return new Response("Not found", { status: 404 });
  return new Response(`google-site-verification: ${expected}`, {
    headers: { "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "public, max-age=300" }
  });
}
