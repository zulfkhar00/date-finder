import type { ReactNode } from "react";

// The fade runs in CSS (globals.css) so server-rendered content paints before hydration.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
