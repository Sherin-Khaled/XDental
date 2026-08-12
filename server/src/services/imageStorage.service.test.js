import assert from "node:assert/strict";
import test from "node:test";
import { readUploadStorageConfiguration } from "../config/uploadStorage.js";
import {
  getManagedObjectKey,
  isManagedImageUrl,
} from "./imageStorage.service.js";

function productionS3Environment(overrides = {}) {
  return {
    NODE_ENV: "production",
    UPLOAD_STORAGE_DRIVER: "s3",
    UPLOAD_S3_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    UPLOAD_S3_REGION: "auto",
    UPLOAD_S3_BUCKET: "xdental-store-production",
    UPLOAD_S3_ACCESS_KEY_ID: "test-access-key",
    UPLOAD_S3_SECRET_ACCESS_KEY: "test-secret-key",
    UPLOAD_S3_PUBLIC_BASE_URL: "https://media.example.com",
    UPLOAD_S3_FORCE_PATH_STYLE: "false",
    ...overrides,
  };
}

test("development keeps the existing local upload storage by default", () => {
  assert.deepEqual(readUploadStorageConfiguration({ NODE_ENV: "development" }), {
    driver: "local",
    production: false,
  });
});

test("production refuses local upload storage", () => {
  assert.throws(
    () =>
      readUploadStorageConfiguration({
        NODE_ENV: "production",
        UPLOAD_STORAGE_DRIVER: "local",
      }),
    /cannot be "local" in production/
  );
});

test("production fails clearly when object storage settings are missing", () => {
  assert.throws(
    () => readUploadStorageConfiguration({ NODE_ENV: "production" }),
    /UPLOAD_S3_ENDPOINT.*UPLOAD_S3_PUBLIC_BASE_URL.*missing/
  );
});

test("object storage requires valid HTTPS endpoints", () => {
  assert.throws(
    () =>
      readUploadStorageConfiguration(
        productionS3Environment({ UPLOAD_S3_ENDPOINT: "malformed text" })
      ),
    /UPLOAD_S3_ENDPOINT must be a valid absolute URL/
  );
  assert.throws(
    () =>
      readUploadStorageConfiguration(
        productionS3Environment({
          UPLOAD_S3_PUBLIC_BASE_URL: "http://media.example.com",
        })
      ),
    /UPLOAD_S3_PUBLIC_BASE_URL must use HTTPS/
  );
  assert.throws(
    () =>
      readUploadStorageConfiguration(
        productionS3Environment({
          UPLOAD_S3_ENDPOINT: "https://127.0.0.1:9000",
        })
      ),
    /must not point to localhost in production/
  );
});

test("valid S3-compatible production settings are normalized safely", () => {
  const configuration = readUploadStorageConfiguration(
    productionS3Environment({
      UPLOAD_S3_PUBLIC_BASE_URL: "https://media.example.com/assets///",
      UPLOAD_S3_FORCE_PATH_STYLE: "true",
    })
  );

  assert.equal(configuration.driver, "s3");
  assert.equal(configuration.endpoint, "https://account-id.r2.cloudflarestorage.com");
  assert.equal(configuration.publicBaseUrl, "https://media.example.com/assets");
  assert.equal(configuration.forcePathStyle, true);
});

test("managed object recognition accepts only exact storage URLs and safe keys", () => {
  const configuration = readUploadStorageConfiguration(
    productionS3Environment()
  );
  const productUrl =
    "https://media.example.com/product-images/product-123e4567-e89b-12d3-a456-426614174000.webp";

  assert.equal(
    getManagedObjectKey("product", productUrl, configuration),
    "product-images/product-123e4567-e89b-12d3-a456-426614174000.webp"
  );
  assert.equal(
    getManagedObjectKey(
      "product",
      "https://media.example.com.evil.test/product-images/product-123.webp",
      configuration
    ),
    null
  );
  assert.equal(
    getManagedObjectKey(
      "product",
      "https://media.example.com/profile-images/product-123.webp",
      configuration
    ),
    null
  );
  assert.equal(
    getManagedObjectKey(
      "product",
      "https://media.example.com/product-images/not-managed.webp",
      configuration
    ),
    null
  );
});

test("existing local upload URLs remain managed during development", () => {
  assert.equal(
    isManagedImageUrl(
      "profile",
      "/api/uploads/profile-images/profile-123e4567-e89b-12d3-a456-426614174000.jpg"
    ),
    true
  );
  assert.equal(
    isManagedImageUrl("profile", "/api/uploads/profile-images/other.jpg"),
    false
  );
});
