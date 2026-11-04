import assert from "node:assert/strict";

const baseUrl = process.env.DEMO_TEST_BASE_URL ?? "http://localhost:3000";
const paths = ["/demo", "/demo/chats", "/demo/dates", "/demo/profile"];

for (const path of paths) {
  const response = await fetch(new URL(path, baseUrl));
  assert.equal(response.status, 200, `${path}: public demo route`);
  const html = await response.text();
  const nav = html.match(/<nav\b[^>]*aria-label="Main"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, `${path}: main navigation`);
  const links = [...nav.matchAll(/<a\b([^>]*)>/g)].map((match) => ({
    href: match[1].match(/href="([^"]+)"/)?.[1],
    active: /aria-current="page"/.test(match[1]),
  }));
  assert.deepEqual(links.map((link) => link.href), paths, `${path}: all navigation targets exist`);
  assert.deepEqual(links.filter((link) => link.active).map((link) => link.href), [path], `${path}: only its own tab is active`);
}

console.log("demo HTTP: all four navigation targets return 200 and select only their own tab");
