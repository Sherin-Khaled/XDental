import assert from "node:assert/strict";
import test from "node:test";
import { calculateSupportSummary } from "./supportSummary.ts";

test("support summary counts every unresolved status as active", () => {
  const summary = calculateSupportSummary([
    { status: "Open", priority: "Normal" },
    { status: "Waiting for Support", priority: "Urgent" },
    { status: "Waiting for Customer", priority: "Normal" },
    { status: "Resolved", priority: "Urgent" },
  ]);

  assert.deepEqual(summary, {
    active: 3,
    waiting: 1,
    resolved: 1,
    urgent: 1,
  });
});
