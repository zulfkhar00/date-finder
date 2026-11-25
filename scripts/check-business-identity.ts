import assert from "node:assert/strict";
import { BUSINESS, businessIdentity } from "../src/lib/business";

// A half-filled identity must stay hidden.
assert.equal(businessIdentity({ legalName: "", addressLines: [] }), null);
assert.equal(businessIdentity({ legalName: "Example Co", addressLines: [] }), null);
assert.equal(businessIdentity({ legalName: "Example Co", addressLines: ["  "] }), null);
assert.equal(businessIdentity({ legalName: "  ", addressLines: ["1 Example Street"] }), null);
assert.deepEqual(
  businessIdentity({ legalName: " Example Co ", addressLines: [" 1 Example Street ", "", "Sampletown"] }),
  { legalName: "Example Co", addressLines: ["1 Example Street", "Sampletown"] }
);
// The committed value is either complete or entirely empty.
assert.equal(
  businessIdentity() !== null,
  Boolean(BUSINESS.legalName || BUSINESS.addressLines.length),
  "src/lib/business.ts needs both legalName and addressLines, or neither"
);
console.log("business identity checks passed");
