import { NextResponse } from "next/server";
import { paidAccessFor } from "@/lib/paid-access";

export const dynamic = "force-dynamic";

/**
 * Is the paid service offered to this visitor? The landing and guide pages are cached, so they ask here after load.
 * Only a boolean leaves the server (never the country). Fails open: an error shows no notice and checkout still gates.
 */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const access = await paidAccessFor(request.headers);
    return NextResponse.json({ available: access.allowed }, { headers });
  } catch {
    return NextResponse.json({ available: true }, { headers });
  }
}
