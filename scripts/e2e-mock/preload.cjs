/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS preload loaded with --require */
// Loaded with NODE_OPTIONS=--require into the Next dev server. Two jobs:
//  1. Re-route the only third-party hosts the server talks to (Stripe, Resend, Telegram) to the local mock.
//  2. Refuse every other non-local host, so nothing (production Supabase, live Stripe, PostHog, Sentry) can be reached.
const MOCK = process.env.MOCK_ORIGIN || "http://127.0.0.1:54399";
const mock = new URL(MOCK);
const ROUTES = { "api.stripe.com": "/stripe", "api.resend.com": "/resend", "api.telegram.org": "/telegram", "api.anthropic.com": "/anthropic" };
const isLocal = (h) => h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
const blocked = [];

const realFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const u = new URL(raw, "http://localhost");
  if (ROUTES[u.hostname]) {
    const target = `${MOCK}${ROUTES[u.hostname]}${u.pathname}${u.search}`;
    return realFetch(target, typeof input === "object" && !(input instanceof URL) && !init ? new Request(target, input) : init);
  }
  if (!isLocal(u.hostname)) { blocked.push(u.hostname); throw new Error(`e2e-mock: blocked outbound fetch to ${u.hostname}`); }
  return realFetch(input, init);
};

for (const mod of ["https", "http"]) {
  const m = require(mod);
  const orig = m.request;
  m.request = function (a, b, c) {
    let opts = typeof a === "string" || a instanceof URL ? { ...(b || {}), ...urlToOpts(new URL(a)) } : { ...a };
    const cb = typeof a === "string" || a instanceof URL ? c : b;
    const host = (opts.hostname || opts.host || "localhost").replace(/:\d+$/, "");
    if (ROUTES[host]) {
      opts = { ...opts, protocol: "http:", hostname: mock.hostname, host: mock.hostname, port: mock.port, path: ROUTES[host] + opts.path, agent: undefined };
      const req = require("http").request(opts, cb);
      // stripe-node waits for "secureConnect" before writing the body; the mock speaks plain http.
      const once = req.once.bind(req);
      req.once = (ev, fn) => ev === "socket" ? once("socket", (sock) => { const so = sock.once.bind(sock); sock.once = (e, f) => so(e === "secureConnect" ? "connect" : e, f); fn(sock); }) : once(ev, fn);
      return req;
    }
    if (!isLocal(host)) { blocked.push(host); throw new Error(`e2e-mock: blocked outbound request to ${host}`); }
    return orig.call(m, opts, cb);
  };
}
function urlToOpts(u) { return { protocol: u.protocol, hostname: u.hostname, port: u.port, path: u.pathname + u.search }; }
