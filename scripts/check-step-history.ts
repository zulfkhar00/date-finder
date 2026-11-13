// Checks for browser back/forward handling inside onboarding. No browser needed: the decision is pure.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidePop, stepFromState, stepState } from "../src/lib/app/step-history";

const LAST_FORM = 5;
assert.equal(stepFromState(stepState(3)), 3);
assert.equal(stepFromState(null), null);
assert.equal(stepFromState({ nsStep: -1 }), null);
assert.equal(stepFromState({ nsStep: "2" }), null);
assert.equal(stepFromState({ nsStep: 1.5 }), null);

assert.deepEqual(decidePop(3, stepState(2), LAST_FORM, false), { action: "go", step: 2 }, "back goes to the previous question");
assert.deepEqual(decidePop(2, stepState(3), LAST_FORM, false), { action: "go", step: 3 }, "forward goes to the next question");
assert.deepEqual(decidePop(0, null, LAST_FORM, false), { action: "ignore" }, "back past the first question leaves the flow");
assert.deepEqual(decidePop(2, {}, LAST_FORM, false), { action: "ignore" }, "an entry that is not ours is left to the router");
assert.deepEqual(decidePop(2, stepState(2), LAST_FORM, false), { action: "ignore" }, "same screen: nothing to do");
assert.deepEqual(decidePop(3, stepState(2), LAST_FORM, true), { action: "stay" }, "no moving while a save is in flight");
assert.deepEqual(decidePop(6, stepState(5), LAST_FORM, false), { action: "stay" }, "the pay step has no way back to the finished form");
assert.deepEqual(decidePop(4, stepState(6), LAST_FORM, false), { action: "stay" }, "forward into pay needs the form to be finished");

const flow = readFileSync(new URL("../src/app/onboarding/flow.tsx", import.meta.url), "utf8");
assert.match(flow, /pushState\(stepState\(n\)/, "each screen is a history entry");
assert.match(flow, /addEventListener\("popstate"/, "back/forward is handled");
assert.match(flow, /removeEventListener\("popstate"/, "the listener is removed on unmount");
console.log("step history checks ok");
