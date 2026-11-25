// Who gets a sign-in code and who gets an account. Fake Supabase and mail; no network, no database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEND_LIMIT } from "../src/lib/app/code-send-limit";
import { createCodeRequester, deliverSignInCode, type CodeMode, type LoginState } from "../src/lib/app/sign-in-code";

type World = { accounts: string[]; reservations?: { email: string; status: string }[]; lookupError?: boolean; reservationError?: boolean };

/** The parts of Supabase the flow uses. generateLink behaves like GoTrue: "magiclink" signs an unknown address up. */
function fake(world: World) {
  const accounts = new Set(world.accounts);
  const calls: string[] = [];
  const mail: string[] = [];
  const admin = {
    auth: {
      admin: {
        async createUser({ email }: { email: string }) {
          calls.push("createUser");
          if (accounts.has(email)) return { data: { user: null }, error: { code: "email_exists", status: 422 } };
          accounts.add(email);
          return { data: { user: {} }, error: null };
        },
        async generateLink({ type, email }: { type: string; email: string }) {
          calls.push(type);
          if (type === "recovery") {
            if (world.lookupError) return { data: { properties: null }, error: { code: "unexpected_failure", status: 500 } };
            if (!accounts.has(email)) return { data: { properties: null }, error: { code: "user_not_found", status: 404 } };
          }
          accounts.add(email);
          return { data: { properties: { hashed_token: "hash", email_otp: "123456" } }, error: null };
        }
      }
    },
    from(table: string) {
      assert.equal(table, "reservations");
      const want: Record<string, string> = {};
      const query = {
        select: () => query,
        eq: (k: string, v: string) => { want[k] = v; return query; },
        limit: async () => world.reservationError
          ? { data: null, error: { code: "XX000" } }
          : { data: (world.reservations ?? []).filter((r) => r.email === want.email && r.status === want.status), error: null }
      };
      return query;
    }
  } as unknown as SupabaseClient;
  const deliver = (email: string, mode: CodeMode) => deliverSignInCode({ admin, siteUrl: "https://www.noswipe.app", send: async (to) => { mail.push(to); return true; } }, email, mode);
  return { accounts, calls, mail, deliver };
}

const form = (email: string) => { const f = new FormData(); f.set("email", email); return f; };
const START: LoginState = { step: "email" };

async function main() {
  // /login, existing account: gets mail, nothing new is created.
  let w = fake({ accounts: ["member@x.test"] });
  assert.equal(await w.deliver("member@x.test", "existing"), "sent");
  assert.deepEqual(w.mail, ["member@x.test"]);
  assert.deepEqual(w.calls, ["recovery", "magiclink"]);
  assert.equal(w.accounts.size, 1);

  // /login, unknown address: no account, no email, and "magiclink" (which would sign it up) is never asked for.
  w = fake({ accounts: ["member@x.test"] });
  assert.equal(await w.deliver("stranger@x.test", "existing"), "no_account");
  assert.deepEqual(w.mail, []);
  assert.deepEqual(w.calls, ["recovery"]);
  assert.deepEqual([...w.accounts], ["member@x.test"]);

  // A paid reservation without an account still gets one on /login. Other statuses do not.
  w = fake({ accounts: [], reservations: [{ email: "paid@x.test", status: "paid" }] });
  assert.equal(await w.deliver("paid@x.test", "existing"), "sent");
  assert.deepEqual([...w.accounts], ["paid@x.test"]);
  assert.deepEqual(w.mail, ["paid@x.test"]);
  for (const status of ["pending", "expired", "refunded"]) {
    w = fake({ accounts: [], reservations: [{ email: "p@x.test", status }] });
    assert.equal(await w.deliver("p@x.test", "existing"), "no_account", status);
    assert.equal(w.accounts.size + w.mail.length, 0, status);
  }

  // A failed lookup creates and sends nothing.
  for (const broken of [{ lookupError: true }, { reservationError: true }]) {
    w = fake({ accounts: [], ...broken });
    assert.equal(await w.deliver("a@x.test", "existing"), "failed");
    assert.equal(w.accounts.size + w.mail.length, 0);
    assert.ok(!w.calls.includes("magiclink") && !w.calls.includes("createUser"));
  }

  // Onboarding still creates the account; an address that already has one is simply mailed.
  w = fake({ accounts: [] });
  assert.equal(await w.deliver("new@x.test", "signup"), "sent");
  assert.deepEqual([...w.accounts], ["new@x.test"]);
  assert.equal(await w.deliver("new@x.test", "signup"), "sent");
  assert.equal(w.accounts.size, 1);
  assert.equal(w.mail.length, 2);

  // ---------- the request step ----------
  const request = (world: World, ip = "203.0.113.9") => {
    const f = fake(world);
    const deferred: (() => Promise<unknown>)[] = [];
    let now = Date.parse("2026-11-25T00:00:00Z");
    const ask = createCodeRequester({ ready: () => true, clientIp: async () => ip, deliver: f.deliver, defer: (t) => { deferred.push(t); }, now: () => now });
    return { ...f, ask, deferred, tick: (ms: number) => { now += ms; }, flush: async () => { while (deferred.length) await deferred.shift()!(); } };
  };

  // /login answers the same for a known and an unknown address, before anything is looked up.
  const r = request({ accounts: ["member@x.test"] });
  const known = await r.ask("existing", START, form("Member@X.test"));
  const unknown = await r.ask("existing", START, form("stranger@x.test"));
  assert.deepEqual({ ...known, email: "" }, { ...unknown, email: "" });
  assert.equal(known.step, "code");
  assert.equal(known.email, "member@x.test");
  assert.deepEqual(r.calls, [], "nothing runs before the response");
  await r.flush();
  assert.deepEqual(r.mail, ["member@x.test"]);
  assert.equal(r.accounts.size, 1);

  // Trying /login first does not delay the signup that follows it.
  const signup = await r.ask("signup", START, form("stranger@x.test"));
  assert.equal(signup.step, "code");
  assert.deepEqual(r.mail, ["member@x.test", "stranger@x.test"]);
  assert.equal(r.deferred.length, 0, "onboarding sends before it answers, so a failure can be shown");
  // One address, one send per 45 s in each form.
  await r.ask("signup", signup, form("stranger@x.test"));
  await r.ask("existing", START, form("member@x.test"));
  await r.flush();
  assert.equal(r.mail.length, 2);
  r.tick(46_000);
  await r.ask("existing", START, form("member@x.test"));
  await r.flush();
  assert.equal(r.mail.length, 3);

  // The per-network limit still holds, across both forms, and counts unknown addresses the same as known ones.
  const l = request({ accounts: [] });
  for (let i = 0; i < SEND_LIMIT; i++) assert.equal((await l.ask(i % 2 ? "existing" : "signup", START, form(`n${i}@x.test`))).error, undefined);
  await l.flush();
  const before = { accounts: l.accounts.size, mail: l.mail.length, calls: l.calls.length };
  for (const mode of ["existing", "signup"] as const) {
    const refused = await l.ask(mode, START, form(`over-${mode}@x.test`));
    assert.equal(refused.step, "email");
    assert.match(refused.error ?? "", /Too many sign-in codes/);
  }
  const resend = await l.ask("existing", { step: "code", email: "again@x.test" }, form("again@x.test"));
  assert.equal(resend.step, "code");
  assert.match(resend.error ?? "", /enter a code you already received/);
  assert.equal(l.deferred.length, 0);
  assert.deepEqual({ accounts: l.accounts.size, mail: l.mail.length, calls: l.calls.length }, before);

  // Wiring: /login uses the existing-only action, onboarding the signup one.
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(read("../src/app/login/actions.ts"), /requestSignInCode\("existing"/);
  assert.doesNotMatch(read("../src/app/login/actions.ts"), /"signup"/);
  assert.match(read("../src/app/onboarding/actions.ts"), /requestSignInCode\("signup"/);
  assert.match(read("../src/app/onboarding/account-step.tsx"), /useActionState<LoginState, FormData>\(requestSignupCode,/);
  assert.doesNotMatch(read("../src/app/login/login-form.tsx"), /requestSignupCode/);
  assert.match(read("../src/app/login/page.tsx"), /New here\? <a href="\/onboarding"/);
  console.log("sign-in code checks ok");
}

main().catch((error) => { console.error(error); process.exit(1); });
