import test from "node:test";
import assert from "node:assert/strict";
import { publicOrderTrackingRateLimit } from "./rateLimit.middleware.js";

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

test("public tracking is limited to five attempts per IP in ten minutes", () => {
  const request = { ip: "203.0.113.42", socket: {} };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = responseRecorder();
    let continued = false;
    publicOrderTrackingRateLimit(request, response, () => {
      continued = true;
    });
    assert.equal(continued, true);
    assert.equal(response.headers.get("RateLimit-Limit"), "5");
    assert.equal(response.headers.get("RateLimit-Policy"), "5;w=600");
  }

  const blockedResponse = responseRecorder();
  publicOrderTrackingRateLimit(request, blockedResponse, () => {
    assert.fail("The sixth attempt must not continue.");
  });
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.payload.code, "RATE_LIMITED");
});
