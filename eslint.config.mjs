import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Photos are private, short-lived signed URLs: the Next image optimizer must not proxy or cache them.
    files: ["src/components/app/**", "src/app/(app)/**", "src/app/admin/clients/**"],
    rules: { "@next/next/no-img-element": "off" }
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])
]);
