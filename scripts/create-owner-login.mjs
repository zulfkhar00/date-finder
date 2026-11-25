// Creates (or resets) the owner's email + password login for /app/login. Run it once, with the server-side Supabase
// env of the target project in the environment (SUPABASE_URL, SUPABASE_SECRET_KEY):
//
//   node scripts/create-owner-login.mjs [credentials-file]
//
// The credentials file (default ~/.config/noswipe/app-login.txt, mode 600) holds two lines, `email=` and `password=`.
// The password is never printed.
// Idempotent: an existing user gets the file's password and a confirmed email; a missing one is created.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const file = process.argv[2] ?? join(homedir(), ".config/noswipe/app-login.txt");
const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (server-side env) first.");
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`No credentials file at ${file}.`);
  process.exit(2);
}
const creds = Object.fromEntries(readFileSync(file, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]));
if (!creds.email || !creds.password || creds.password.length < 12) {
  console.error("The credentials file needs email= and a password= of at least 12 characters.");
  process.exit(2);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const email = creds.email.toLowerCase();

async function findUser() {
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
    if (!res.ok) throw new Error(`list users failed (${res.status})`);
    const { users } = await res.json();
    const hit = users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

const existing = await findUser();
const body = JSON.stringify({ email, password: creds.password, email_confirm: true });
const res = existing
  ? await fetch(`${url}/auth/v1/admin/users/${existing.id}`, { method: "PUT", headers, body })
  : await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers, body });
if (!res.ok) {
  console.error(`Supabase refused (${res.status}).`);
  process.exit(1);
}
console.log(existing ? "Updated the existing user: password set, email confirmed." : "Created the user: email confirmed.");
console.log("Reminder: this address must be in ADMIN_EMAILS (or OWNER_APP_EMAILS) on the server, or /app stays a 404 for it.");
