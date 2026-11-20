// Local stand-ins for Supabase (GoTrue + PostgREST + the finalize_reservation RPC), Stripe, Resend and
// Telegram, so the signup -> onboarding -> pay -> confirmation flow can run with no network and no
// real credentials. Everything lives in memory. NOT Stripe: payment is simulated by /__stripe/pay.
//
//   node scripts/e2e-mock/mock-services.mjs            (port 54399)
//
// Control endpoints: GET /__state, GET /__outbox, POST /__stripe/pay?session=cs_test_...
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.MOCK_PORT || 54399);
const APP = process.env.APP_ORIGIN || "http://localhost:3000";
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mockmockmockmockmockmockmock";
const JWT_SECRET = "mock-jwt-secret";
const here = path.dirname(fileURLToPath(import.meta.url));

// ---- schema facts copied from supabase/*.sql so the mock rejects what Postgres would reject ----
const sqlDir = path.join(here, "../../supabase");
const eventList = (() => {
  const sql = fs.readFileSync(path.join(sqlDir, "2026-11-11-resume-card-events.sql"), "utf8");
  const body = sql.slice(sql.indexOf("check (event in ("));
  return [...body.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]);
})();
const CHECKS = {
  reservations: (r) =>
    ["women", "men", "all_genders", "discuss"].includes(r.dating_preference) &&
    ["committed", "meaningful", "exploring"].includes(r.relationship_goal) &&
    ["monthly", "twice_monthly", "weekly"].includes(r.date_frequency) &&
    typeof r.email === "string" && r.email.length >= 3 && typeof r.city === "string" && r.city.length >= 2,
  funnel_events: (r) => eventList.includes(r.event)
};
const UNIQUE = { reservations: ["stripe_checkout_session_id", "stripe_payment_intent_id", "queue_position"], funnel_events: ["dedupe_key"], profiles: ["user_id"], preferences: ["user_id"], consents: [] };
const PK = { profiles: "user_id", preferences: "user_id" };

const db = { reservations: [], funnel_events: [], profiles: [], preferences: [], app_accounts: [], consents: [], profile_photos: [], matches: [], messages: [], takeovers: [], dates: [] };
const users = new Map(); // id -> {id,email,otp,otp_hash}
const outbox = { email: [], telegram: [] };
const stripe = { sessions: new Map(), violations: [] };
let queue = 0;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600, session_id: crypto.randomUUID() });
  return `${head}.${body}.${crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
}
const userJson = (u) => ({ id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.created, confirmed_at: u.created, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: u.created, updated_at: u.created });
const sessionJson = (u) => ({ access_token: jwt(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}`, user: userJson(u) });

const read = (req) => new Promise((res) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c).toString())); });
const send = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(body === undefined ? "" : JSON.stringify(body)); };
const rand = (n) => crypto.randomBytes(n).toString("base64url").replace(/[^A-Za-z0-9]/g, "a").slice(0, n);

// ---- PostgREST ----
function matcher(params) {
  const tests = [];
  for (const [key, val] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    let op = val, neg = false;
    if (op.startsWith("not.")) { neg = true; op = op.slice(4); }
    const [name, ...rest] = op.split(".");
    const arg = rest.join(".");
    const fn = (row) => {
      const v = row[key];
      switch (name) {
        case "eq": return String(v) === arg;
        case "neq": return String(v) !== arg;
        case "lt": return v != null && v < (isNaN(arg) ? arg : Number(arg));
        case "gte": return v != null && v >= (isNaN(arg) ? arg : Number(arg));
        case "gt": return v != null && v > (isNaN(arg) ? arg : Number(arg));
        case "is": return arg === "null" ? v == null : String(v) === arg;
        case "in": return arg.slice(1, -1).split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(v));
        default: throw new Error(`mock PostgREST: unsupported filter ${key}=${val}`);
      }
    };
    tests.push((row) => (neg ? !fn(row) : fn(row)));
  }
  return (row) => tests.every((t) => t(row));
}
const violates = (table, row, others) => {
  for (const col of UNIQUE[table] ?? []) if (row[col] != null && others.some((o) => o !== row && o[col] === row[col])) return `duplicate key value violates unique constraint (${col})`;
  return null;
};
function project(rows, select) {
  if (!select || select === "*" || select.includes("(")) return rows;
  const cols = select.split(",").map((s) => s.trim());
  return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
}

async function rest(req, res, url) {
  const table = url.pathname.replace("/rest/v1/", "");
  const params = url.searchParams;
  const prefer = req.headers.prefer || "";
  const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
  if (table.startsWith("rpc/")) return rpc(req, res, table.slice(4));
  if (!(table in db)) return send(res, 404, { code: "PGRST205", message: `Could not find the table 'public.${table}'` });
  const rows = db[table];
  const respond = (out, status = 200, extra = {}) => {
    if (wantsObject) {
      if (out.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
      return send(res, status, out[0], extra);
    }
    return send(res, status, out, extra);
  };
  const raw = req.method === "GET" || req.method === "HEAD" || req.method === "DELETE" ? "" : await read(req);
  const body = raw ? JSON.parse(raw) : null;
  const now = new Date().toISOString();

  if (req.method === "GET" || req.method === "HEAD") {
    let out = rows.filter(matcher(params));
    const order = params.get("order");
    if (order) { const [col, dir] = order.split("."); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === "desc" ? -1 : 1)); }
    const total = out.length;
    if (params.get("limit")) out = out.slice(0, Number(params.get("limit")));
    const headers = { "Content-Range": `0-${Math.max(total - 1, 0)}/${total}` };
    if (req.method === "HEAD") { res.writeHead(200, headers); return res.end(); }
    return respond(project(out, params.get("select")), 200, headers);
  }
  if (req.method === "POST") {
    const list = Array.isArray(body) ? body : [body];
    const upsert = prefer.includes("resolution=");
    const onConflict = params.get("on_conflict") || PK[table];
    const inserted = [];
    for (const input of list) {
      const row = { ...input };
      if (!(PK[table]) && !row.id) row.id = table === "funnel_events" || table === "profile_photos" ? crypto.randomUUID() : crypto.randomUUID();
      row.created_at ??= now;
      if (table === "reservations") { row.status ??= "pending"; row.stripe_checkout_session_id ??= null; row.stripe_payment_intent_id ??= null; row.queue_position ??= null; }
      if (table === "profiles") { row.onboarding_step ??= 0; row.onboarding_done_at ??= null; }
      if (CHECKS[table] && !CHECKS[table](row)) return send(res, 400, { code: "23514", message: `new row for relation "${table}" violates check constraint` });
      const existing = onConflict ? rows.find((o) => o[onConflict] != null && o[onConflict] === row[onConflict]) : undefined;
      if (upsert && existing) {
        if (prefer.includes("merge-duplicates")) Object.assign(existing, row, { id: existing.id, created_at: existing.created_at });
        continue; // ignore-duplicates: not returned
      }
      const dup = violates(table, row, rows);
      if (dup) return send(res, 409, { code: "23505", message: dup });
      rows.push(row); inserted.push(row);
    }
    if (prefer.includes("return=representation")) return respond(project(inserted, params.get("select")), 201);
    return send(res, 201);
  }
  if (req.method === "PATCH") {
    const hit = rows.filter(matcher(params));
    for (const row of hit) {
      const next = { ...row, ...body };
      if (CHECKS[table] && !CHECKS[table](next)) return send(res, 400, { code: "23514", message: "check constraint" });
      Object.assign(row, body);
    }
    if (prefer.includes("return=representation")) return respond(project(hit, params.get("select")));
    return send(res, 204);
  }
  if (req.method === "DELETE") {
    const test = matcher(params);
    const keep = rows.filter((r) => !test(r));
    const gone = rows.length - keep.length;
    rows.length = 0; rows.push(...keep);
    return send(res, prefer.includes("return=representation") ? 200 : 204, prefer.includes("return=representation") ? [] : undefined, { "x-deleted": String(gone) });
  }
  return send(res, 405, { message: "unsupported" });
}

async function rpc(req, res, name) {
  const args = JSON.parse((await read(req)) || "{}");
  if (name !== "finalize_reservation") return send(res, 404, { code: "PGRST202", message: `rpc ${name} not mocked` });
  // Mirrors supabase/schema.sql finalize_reservation.
  const r = db.reservations.find((x) => x.id === args.p_reservation_id);
  const fail = (m) => send(res, 400, { code: "P0001", message: m });
  if (!r || r.stripe_checkout_session_id !== args.p_session_id) return fail("Reservation or checkout session mismatch");
  if (["paid", "refunded"].includes(r.status)) return r.stripe_payment_intent_id === args.p_payment_intent_id ? send(res, 200, r.queue_position) : fail("Payment intent mismatch");
  if (r.status !== "pending") return fail("Reservation is no longer pending");
  Object.assign(r, { status: "paid", queue_position: ++queue, stripe_payment_intent_id: args.p_payment_intent_id, paid_at: new Date().toISOString() });
  return send(res, 200, r.queue_position);
}

// ---- GoTrue ----
async function auth(req, res, url) {
  const p = url.pathname.replace("/auth/v1", "");
  const body = req.method === "POST" ? JSON.parse((await read(req)) || "{}") : {};
  if (p === "/admin/users" && req.method === "POST") {
    if ([...users.values()].some((u) => u.email === body.email)) return send(res, 422, { code: 422, error_code: "email_exists", msg: "A user with this email address has already been registered" });
    const u = { id: crypto.randomUUID(), email: body.email, created: new Date().toISOString() };
    users.set(u.id, u);
    return send(res, 200, userJson(u));
  }
  if (p === "/admin/generate_link") {
    const u = [...users.values()].find((x) => x.email === body.email);
    if (!u) return send(res, 404, { code: 404, error_code: "user_not_found", msg: "User not found" });
    u.otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    u.hash = rand(40);
    return send(res, 200, { ...userJson(u), action_link: `${APP}/auth/callback?token_hash=${u.hash}&type=email`, email_otp: u.otp, hashed_token: u.hash, verification_type: "magiclink", redirect_to: APP, properties: { action_link: "", email_otp: u.otp, hashed_token: u.hash, redirect_to: APP, verification_type: "magiclink" } });
  }
  if (p === "/verify") {
    const u = [...users.values()].find((x) => x.email === body.email && x.otp && x.otp === body.token) || [...users.values()].find((x) => x.hash && x.hash === body.token_hash);
    if (!u) return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
    u.otp = u.hash = undefined;
    return send(res, 200, sessionJson(u));
  }
  if (p === "/user") {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    try {
      const [h, b, s] = token.split(".");
      if (crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url") !== s) throw new Error("sig");
      const claims = JSON.parse(Buffer.from(b, "base64url").toString());
      const u = users.get(claims.sub);
      if (!u) throw new Error("nouser");
      return send(res, 200, userJson(u));
    } catch { return send(res, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT" }); }
  }
  if (p === "/token") {
    const u = users.get(String(body.refresh_token || "").replace(/^r-/, ""));
    return u ? send(res, 200, sessionJson(u)) : send(res, 400, { error_code: "refresh_token_not_found", msg: "bad refresh token" });
  }
  if (p === "/logout") return send(res, 204);
  return send(res, 404, { msg: `auth ${p} not mocked` });
}

// ---- Stripe (API surface used by src/app/api/checkout/route.ts) ----
function form(body) {
  const out = {};
  for (const [k, v] of new URLSearchParams(body)) {
    const keys = k.replace(/\]/g, "").split("[");
    let o = out;
    keys.forEach((key, i) => { if (i === keys.length - 1) o[key] = v; else o = o[key] ??= {}; });
  }
  return out;
}
async function stripeApi(req, res, url) {
  const key = (req.headers.authorization || "").replace("Bearer ", "");
  if (!key.startsWith("sk_test_")) { stripe.violations.push(`non-test key used: ${key.slice(0, 7)}`); return send(res, 401, { error: { message: "mock refuses non-test keys" } }); }
  const p = url.pathname.replace("/stripe", "");
  const raw = req.method === "POST" ? await read(req) : "";
  if (p === "/v1/checkout/sessions" && req.method === "POST") {
    const f = form(raw);
    const id = `cs_test_${rand(40)}`;
    const embedded = f.ui_mode === "embedded_page" || f.ui_mode === "embedded";
    const s = {
      id, object: "checkout.session", livemode: false, mode: f.mode, status: "open", payment_status: "unpaid", currency: "usd",
      amount_total: Number(f.line_items?.["0"]?.price_data?.unit_amount) * Number(f.line_items?.["0"]?.quantity || 1),
      customer_email: f.customer_email, client_reference_id: f.client_reference_id, metadata: f.metadata || {}, payment_intent: null,
      ui_mode: f.ui_mode || "hosted", return_url: f.return_url, success_url: f.success_url,
      client_secret: embedded ? `${id}_secret_${rand(40)}` : null, url: embedded ? null : `https://checkout.stripe.com/c/pay/${id}#mock`
    };
    stripe.sessions.set(id, s);
    return send(res, 200, s);
  }
  const m = p.match(/^\/v1\/checkout\/sessions\/(cs_test_[A-Za-z0-9]+)(\/expire)?$/);
  if (m) {
    const s = stripe.sessions.get(m[1]);
    if (!s) return send(res, 404, { error: { type: "invalid_request_error", code: "resource_missing", message: "No such checkout.session" } });
    if (m[2]) { s.status = "expired"; return send(res, 200, s); }
    return send(res, 200, s);
  }
  return send(res, 404, { error: { message: `stripe ${p} not mocked` } });
}

async function stripeSign(payload) {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", WHSEC).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

async function pay(sessionId) {
  const s = stripe.sessions.get(sessionId);
  if (!s) return { status: 404, body: { error: "unknown session" } };
  s.status = "complete"; s.payment_status = "paid"; s.payment_intent = `pi_test_${rand(24)}`;
  const event = { id: `evt_test_${rand(20)}`, object: "event", type: "checkout.session.completed", livemode: false, api_version: "2025-01-01", created: Math.floor(Date.now() / 1000), data: { object: s } };
  const payload = JSON.stringify(event);
  const r = await fetch(`${APP}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": await stripeSign(payload) }, body: payload });
  return { status: 200, body: { webhookStatus: r.status, sessionId, paymentIntent: s.payment_intent } };
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (process.env.MOCK_LOG && !url.pathname.startsWith("/__")) { const t0 = Date.now(); res.on("finish", () => console.log(`${req.method} ${url.pathname}${url.search.slice(0, 90)} -> ${res.statusCode} ${Date.now() - t0}ms`)); }
  try {
    if (url.pathname.startsWith("/rest/v1/")) return await rest(req, res, url);
    if (url.pathname.startsWith("/auth/v1/")) return await auth(req, res, url);
    if (url.pathname.startsWith("/storage/v1/")) return send(res, 200, []);
    if (url.pathname.startsWith("/stripe/")) return await stripeApi(req, res, url);
    if (url.pathname === "/resend/emails") { const b = JSON.parse(await read(req)); outbox.email.push({ at: new Date().toISOString(), to: b.to, subject: b.subject, text: b.text }); return send(res, 200, { id: `mock_${rand(10)}` }); }
    if (url.pathname.includes("/sendMessage")) { const b = JSON.parse(await read(req)); outbox.telegram.push({ at: new Date().toISOString(), text: b.text }); return send(res, 200, { ok: true, result: {} }); }
    if (url.pathname === "/__outbox") return send(res, 200, outbox);
    if (url.pathname === "/__state") return send(res, 200, { db, stripeSessions: [...stripe.sessions.values()], stripeViolations: stripe.violations, eventList });
    if (url.pathname === "/__stripe/pay") { const r = await pay(url.searchParams.get("session")); return send(res, r.status, r.body, { "Access-Control-Allow-Origin": "*" }); }
    return send(res, 404, { message: `mock: ${url.pathname}` });
  } catch (e) { console.error("mock error", req.method, url.pathname, e.message); send(res, 500, { message: e.message }); }
}).listen(PORT, "127.0.0.1", () => console.log(`mock services on :${PORT}`));
