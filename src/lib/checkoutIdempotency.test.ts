import test from "node:test";
import assert from "node:assert/strict";
import {
  clearCheckoutAttempt,
  completeCheckoutAttemptOnce,
  fingerprintCheckoutAttempt,
  generateCheckoutIdempotencyKey,
  invalidateChangedCheckoutAttempt,
  resolveCheckoutAttempt,
  runSingleCheckoutSubmission,
} from "./checkoutIdempotency.ts";
import type { CreateOrderInput } from "../services/orders.ts";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function cryptoSource(byte: number) {
  return {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      if (array && ArrayBuffer.isView(array)) {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(byte);
      }
      return array;
    },
  };
}

function input(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    customerName: "Dr. Mazen",
    customerEmail: "mazen@example.com",
    customerPhone: "01000000000",
    country: "Egypt",
    governorate: "Cairo",
    cityArea: "Nasr City",
    streetAddress: "Dental Street",
    buildingNumber: "12",
    apartmentFloor: "3",
    postalCode: "",
    deliveryNotes: "",
    clinicName: "X Clinic",
    clinicBranch: "Main",
    orderNotes: "Call first",
    deliveryMethod: "standard",
    paymentMethod: "cash",
    promoCode: "SAVE20",
    items: [
      { productId: "product-b", sku: "B-2", quantity: 2 },
      { productId: "product-a", sku: "A-1", quantity: 1 },
    ],
    ...overrides,
  };
}

test("generates a server-valid key only from secure browser randomness", () => {
  const key = generateCheckoutIdempotencyKey(cryptoSource(7));
  assert.match(key, /^[a-f0-9]{32}$/);
  assert.throws(
    () => generateCheckoutIdempotencyKey({} as Crypto),
    /Secure browser randomness is unavailable/
  );
});

test("network retry retains the same user and checkout fingerprint key", () => {
  const storage = new MemoryStorage();
  const fingerprint = fingerprintCheckoutAttempt(input());
  const first = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(1));
  const retry = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(2));

  assert.equal(first.reused, false);
  assert.equal(retry.reused, true);
  assert.equal(retry.idempotencyKey, first.idempotencyKey);
});

test("material checkout edits invalidate the key and create a new one", () => {
  const storage = new MemoryStorage();
  const initialFingerprint = fingerprintCheckoutAttempt(input());
  const initial = resolveCheckoutAttempt(storage, "customer-a", initialFingerprint, cryptoSource(1));
  const editedFingerprint = fingerprintCheckoutAttempt(input({ buildingNumber: "99" }));

  assert.equal(
    invalidateChangedCheckoutAttempt(storage, "customer-a", editedFingerprint),
    true
  );
  const edited = resolveCheckoutAttempt(storage, "customer-a", editedFingerprint, cryptoSource(2));
  assert.notEqual(edited.idempotencyKey, initial.idempotencyKey);
});

test("accepted price re-review uses a new logical attempt while leaving cart state intact", () => {
  const storage = new MemoryStorage();
  const fingerprint = fingerprintCheckoutAttempt(input());
  const original = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(1));
  const cart = [{ productId: "product-a", quantity: 1 }];

  assert.equal(clearCheckoutAttempt(storage, "customer-a", original.idempotencyKey), true);
  assert.deepEqual(cart, [{ productId: "product-a", quantity: 1 }]);

  const accepted = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(2));
  assert.notEqual(accepted.idempotencyKey, original.idempotencyKey);
});

test("account switching isolates checkout-attempt metadata", () => {
  const storage = new MemoryStorage();
  const fingerprint = fingerprintCheckoutAttempt(input());
  const customerA = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(1));
  const customerB = resolveCheckoutAttempt(storage, "customer-b", fingerprint, cryptoSource(2));
  const customerARetry = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(3));

  assert.notEqual(customerA.idempotencyKey, customerB.idempotencyKey);
  assert.equal(customerARetry.idempotencyKey, customerA.idempotencyKey);
  assert.equal(storage.length, 2);
});

test("active double submissions reuse one promise", async () => {
  const active = { current: null as Promise<string> | null };
  let submissions = 0;
  let release!: (value: string) => void;
  const submit = () => {
    submissions += 1;
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  };
  const first = runSingleCheckoutSubmission(active, submit);
  const second = runSingleCheckoutSubmission(active, submit);

  assert.equal(first, second);
  assert.equal(submissions, 1);
  release("done");
  assert.equal(await first, "done");
  assert.equal(active.current, null);
});

test("creation or replay completion clears cart and attempt only once", () => {
  const storage = new MemoryStorage();
  const fingerprint = fingerprintCheckoutAttempt(input());
  const attempt = resolveCheckoutAttempt(storage, "customer-a", fingerprint, cryptoSource(1));
  const completed = { current: false };
  let cartClearCount = 0;

  const complete = () =>
    completeCheckoutAttemptOnce(completed, () => {
      clearCheckoutAttempt(storage, "customer-a", attempt.idempotencyKey);
      cartClearCount += 1;
    });

  assert.equal(complete(), true);
  assert.equal(complete(), false);
  assert.equal(cartClearCount, 1);
  assert.equal(storage.length, 0);
});

test("fingerprint is stable across item order and harmless normalization", () => {
  const original = input();
  const reordered = input({
    customerEmail: " MAZEN@EXAMPLE.COM ",
    promoCode: " save20 ",
    items: [...original.items].reverse(),
  });
  assert.equal(
    fingerprintCheckoutAttempt(original),
    fingerprintCheckoutAttempt(reordered)
  );
});

test("points or wallet edits create a new checkout idempotency fingerprint", () => {
  const original = fingerprintCheckoutAttempt(input());
  const withPoints = fingerprintCheckoutAttempt(input({ requestedPoints: 100 }));
  const withWallet = fingerprintCheckoutAttempt(input({ requestedWalletAmount: "25.00" }));

  assert.notEqual(withPoints, original);
  assert.notEqual(withWallet, original);
  assert.notEqual(withWallet, withPoints);
});
