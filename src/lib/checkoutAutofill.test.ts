import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEmptyCheckoutContactFields,
  buildCheckoutContactAutofill,
  isValidEgyptianMobilePhone,
  shouldApplyCheckoutContactAutofill,
  shouldResetCheckoutForAccount,
  splitCheckoutDisplayName,
} from "./checkoutAutofill.ts";

test("uses the existing first-word/rest-of-name convention without inventing a surname", () => {
  assert.deepEqual(splitCheckoutDisplayName("  Sherin Ahmed Hassan  "), {
    firstName: "Sherin",
    lastName: "Ahmed Hassan",
  });
  assert.deepEqual(splitCheckoutDisplayName("Sherin"), {
    firstName: "Sherin",
    lastName: "",
  });
});

test("builds normalized contact autofill from the authenticated profile", () => {
  assert.deepEqual(
    buildCheckoutContactAutofill({
      name: "Sherin Ahmed",
      email: "  SHERIN@EXAMPLE.COM ",
      phone: "  +20 101 234 5678 ",
    }),
    {
      firstName: "Sherin",
      lastName: "Ahmed",
      email: "sherin@example.com",
      phone: "+20 101 234 5678",
    }
  );
});

test("fills only available, empty, and untouched fields", () => {
  const current = {
    firstName: "Customer typed",
    lastName: "",
    email: "",
    phone: "",
    governorate: "",
  };
  const result = applyEmptyCheckoutContactFields(
    current,
    {
      firstName: "Profile",
      lastName: "Name",
      email: "profile@example.com",
      phone: "01012345678",
    },
    new Set(["phone"])
  );

  assert.deepEqual(result, {
    firstName: "Customer typed",
    lastName: "Name",
    email: "profile@example.com",
    phone: "",
    governorate: "",
  });
});

test("recognizes account changes but not initial profile loading or refetches", () => {
  assert.equal(shouldResetCheckoutForAccount(undefined, "customer-a"), false);
  assert.equal(shouldResetCheckoutForAccount("customer-a", "customer-a"), false);
  assert.equal(shouldResetCheckoutForAccount("customer-a", "customer-b"), true);
  assert.equal(shouldResetCheckoutForAccount("customer-a", null), true);
  assert.equal(
    shouldApplyCheckoutContactAutofill(null, "customer-a", false),
    true
  );
  assert.equal(
    shouldApplyCheckoutContactAutofill("customer-a", "customer-a", false),
    false
  );
  assert.equal(
    shouldApplyCheckoutContactAutofill("customer-a", "customer-b", true),
    true
  );
});

test("validates supported Egyptian mobile formats in Latin and Arabic digits", () => {
  assert.equal(isValidEgyptianMobilePhone("01012345678"), true);
  assert.equal(isValidEgyptianMobilePhone("+20 101 234 5678"), true);
  assert.equal(isValidEgyptianMobilePhone("0020-101-234-5678"), true);
  assert.equal(isValidEgyptianMobilePhone("٠١٠١٢٣٤٥٦٧٨"), true);
  assert.equal(isValidEgyptianMobilePhone("01012345678 ext 1"), false);
  assert.equal(isValidEgyptianMobilePhone("02012345678"), false);
});
