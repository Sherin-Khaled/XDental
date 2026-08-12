import test from "node:test";
import assert from "node:assert/strict";
import {
  findPublicOrderTracking,
  normalizeEgyptianPhone,
  normalizePublicOrderNumber,
} from "./publicOrderTracking.service.js";

const expectedPhone = "201012345678";

test("normalizes supported Egyptian mobile formats consistently", () => {
  for (const phone of [
    "01012345678",
    "+201012345678",
    "00201012345678",
    "201012345678",
    "٠١٠١٢٣٤٥٦٧٨",
  ]) {
    assert.equal(normalizeEgyptianPhone(phone), expectedPhone);
  }
});

test("rejects missing, invalid, and unreasonably long phone values", () => {
  assert.equal(normalizeEgyptianPhone(""), "");
  assert.equal(normalizeEgyptianPhone("12345"), "");
  assert.equal(normalizeEgyptianPhone("1".repeat(81)), "");
});

test("normalizes order numbers without accepting oversized values", () => {
  assert.equal(normalizePublicOrderNumber("  ord-example  "), "ORD-EXAMPLE");
  assert.equal(normalizePublicOrderNumber("x".repeat(81)), "");
});

function databaseReturning(order, capture = {}) {
  return {
    order: {
      async findUnique(query) {
        capture.query = query;
        return order;
      },
    },
  };
}

test("returns only the approved public fields after a matching phone", async () => {
  const capture = {};
  const createdAt = new Date("2026-07-01T10:00:00.000Z");
  const updatedAt = new Date("2026-07-01T11:00:00.000Z");
  const result = await findPublicOrderTracking(
    databaseReturning({
      orderNumber: "ORD-EXAMPLE",
      customerPhone: "+20 101 234 5678",
      status: "CONFIRMED",
      createdAt,
      updatedAt,
    }, capture),
    { orderNumber: "ord-example", phone: "01012345678" }
  );

  assert.deepEqual(capture.query, {
    where: { orderNumber: "ORD-EXAMPLE" },
    select: {
      orderNumber: true,
      customerPhone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  assert.deepEqual(result, {
    orderNumber: "ORD-EXAMPLE",
    status: "CONFIRMED",
    createdAt,
    updatedAt,
  });
  assert.equal("customerPhone" in result, false);
});

test("fails closed for an unknown order, wrong phone, or missing stored phone", async () => {
  const input = { orderNumber: "ORD-EXAMPLE", phone: "01012345678" };
  assert.equal(await findPublicOrderTracking(databaseReturning(null), input), null);
  assert.equal(
    await findPublicOrderTracking(databaseReturning({
      orderNumber: "ORD-EXAMPLE",
      customerPhone: "01112345678",
      status: "PENDING_REVIEW",
      createdAt: new Date(),
      updatedAt: new Date(),
    }), input),
    null
  );
  assert.equal(
    await findPublicOrderTracking(databaseReturning({
      orderNumber: "ORD-EXAMPLE",
      customerPhone: null,
      status: "PENDING_REVIEW",
      createdAt: new Date(),
      updatedAt: new Date(),
    }), input),
    null
  );
});
