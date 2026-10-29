import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "NoSwipe — screenshot-based dating profile and message help";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "node_modules", "@fontsource");

export default async function OpengraphImage() {
  const [bagel, figtree] = await Promise.all([
    readFile(join(fontDir, "bagel-fat-one", "files", "bagel-fat-one-latin-400-normal.woff")),
    readFile(join(fontDir, "figtree", "files", "figtree-latin-700-normal.woff"))
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FFF8F0", padding: "64px 72px", color: "#22104A", fontFamily: "Figtree" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img alt="" width={72} height={72} src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4gIDxjaXJjbGUgY3g9IjUwIiBjeT0iNTQiIHI9IjQyIiBmaWxsPSIjMjIxMDRBIi8+ICA8Y2lyY2xlIGN4PSI1MCIgY3k9IjQ4IiByPSI0MiIgZmlsbD0iI0M5RjI0RCIgc3Ryb2tlPSIjMjIxMDRBIiBzdHJva2Utd2lkdGg9IjUiLz4gIDxwYXRoIGQ9Ik0yOSA0MmgxMk01OSA0MmgxMiIgc3Ryb2tlPSIjMjIxMDRBIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPiAgPHBhdGggZD0iTTM2IDYycTE4IDQgMzItOSIgc3Ryb2tlPSIjMjIxMDRBIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==" />
          <div style={{ fontFamily: "Bagel", fontSize: 44 }}>NoSwipe</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Bagel", fontSize: 116, lineHeight: 0.95, letterSpacing: -2 }}>Screenshots in.</div>
          <div style={{ display: "flex", fontFamily: "Bagel", fontSize: 116, lineHeight: 0.95, letterSpacing: -2 }}>
            <span style={{ background: "#C9F24D", borderRadius: 24, padding: "0 18px" }}>Drafts out.</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
          <span>Profiles, messages and date plans. You choose what to send.</span>
          <span style={{ background: "#FF5A47", border: "4px solid #22104A", borderRadius: 999, padding: "10px 26px" }}>noswipe.app</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bagel", data: bagel, style: "normal", weight: 400 }, { name: "Figtree", data: figtree, style: "normal", weight: 700 }] }
  );
}
