import test from "node:test";
import assert from "node:assert/strict";
import { getPayPeriod, roundMoney } from "../src/lib/domain.js";

test("accounting month runs from the 21st through the next 20th", () => {
  assert.deepEqual(getPayPeriod("2026-10"), { month: "2026-10", start: "2026-09-21", end: "2026-10-20" });
});

test("January accounting month starts in the previous year", () => {
  assert.deepEqual(getPayPeriod("2027-01"), { month: "2027-01", start: "2026-12-21", end: "2027-01-20" });
});

test("money values round to two decimal places", () => {
  assert.equal(roundMoney(132.5 * 0.09), 11.93);
});
