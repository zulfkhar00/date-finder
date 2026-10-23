import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "NoSwipe — stop swiping, start dating";
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
          <div style={{ width: 72, height: 72, borderRadius: 22, background: "#FF5A47", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Bagel", fontSize: 48, border: "4px solid #22104A" }}>N</div>
          <div style={{ fontFamily: "Bagel", fontSize: 44 }}>NoSwipe</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Bagel", fontSize: 132, lineHeight: 0.95, letterSpacing: -2 }}>Stop swiping.</div>
          <div style={{ display: "flex", fontFamily: "Bagel", fontSize: 132, lineHeight: 0.95, letterSpacing: -2 }}>
            <span>Start&nbsp;</span>
            <span style={{ background: "#C9F24D", borderRadius: 24, padding: "0 18px" }}>dating.</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
          <span>We fix your profile and write your texts. You hit send.</span>
          <span style={{ background: "#FF5A47", border: "4px solid #22104A", borderRadius: 999, padding: "10px 26px" }}>noswipe.app</span>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bagel", data: bagel, style: "normal", weight: 400 }, { name: "Figtree", data: figtree, style: "normal", weight: 700 }] }
  );
}
