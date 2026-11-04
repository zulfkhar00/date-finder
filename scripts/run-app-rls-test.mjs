// Runs supabase/tests/app-rls.sql against a Supabase project through the Management API.
// Usage: SUPABASE_PAT=... SUPABASE_PROJECT_REF=... node scripts/run-app-rls-test.mjs
// The SQL always rolls back; success is the message APP_RLS_OK. Not part of `npm test` (needs a database).
import { readFile } from "node:fs/promises";
const { SUPABASE_PAT: pat, SUPABASE_PROJECT_REF: ref } = process.env;
if (!pat || !ref) { console.error("Set SUPABASE_PAT and SUPABASE_PROJECT_REF"); process.exit(2); }
const query = await readFile(new URL("../supabase/tests/app-rls.sql", import.meta.url), "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST", headers: { Authorization: `Bearer ${pat}`, "content-type": "application/json" }, body: JSON.stringify({ query })
});
const text = await res.text();
if (text.includes("APP_RLS_OK")) { console.log("RLS tests passed (rolled back)"); process.exit(0); }
console.error("RLS tests FAILED:", text.slice(0, 600)); process.exit(1);
