import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import {
  getNotificationRecipient,
  readMailConfiguration,
  validateMailConfiguration,
} from "../config/mail.js";
import {
  createSubmissionEmailDelivery,
  retryEmailDelivery,
} from "./email.service.js";

function mailEnvironment(overrides = {}) {
  return {
    MAIL_ENABLED: "true",
    SMTP_HOST: "smtp.test.invalid",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "mailer",
    SMTP_PASS: "super-secret-password",
    MAIL_FROM_NAME: "X Dental Store",
    MAIL_FROM_EMAIL: "notifications@example.test",
    COMPANY_NOTIFICATION_EMAIL: "company@example.test",
    CONTACT_NOTIFICATION_EMAIL: "contact@example.test",
    APP_BASE_URL: "https://store.example.test",
    ...overrides,
  };
}

function createDatabase() {
  const records = new Map();
  let counter = 0;

  const materialize = (record) => ({
    retryCount: 0,
    lastAttemptAt: null,
    lastRetryAt: null,
    sentAt: null,
    errorMessage: null,
    createdAt: new Date("2026-07-26T10:00:00.000Z"),
    updatedAt: new Date("2026-07-26T10:00:00.000Z"),
    ...record,
  });

  return {
    records,
    emailDelivery: {
      async upsert({ where, create, update }) {
        const existing = [...records.values()].find(
          (item) =>
            item.category === where.category_entityId.category &&
            item.entityId === where.category_entityId.entityId
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return { ...existing };
        }
        const created = materialize({ id: `delivery-${++counter}`, ...create });
        records.set(created.id, created);
        return { ...created };
      },
      async update({ where, data }) {
        const existing = records.get(where.id);
        assert.ok(existing, `Missing delivery ${where.id}`);
        const nextData = { ...data };
        if (nextData.retryCount?.increment) {
          nextData.retryCount = existing.retryCount + nextData.retryCount.increment;
        }
        Object.assign(existing, nextData, { updatedAt: new Date() });
        return { ...existing };
      },
      async findUnique({ where }) {
        return records.get(where.id) ? { ...records.get(where.id) } : null;
      },
      async findMany() {
        return [...records.values()].map((item) => ({ ...item }));
      },
    },
  };
}

test("recipient selection uses dedicated recipient and company fallback", () => {
  const configuration = readMailConfiguration(mailEnvironment());
  assert.equal(getNotificationRecipient("CONTACT", configuration), "contact@example.test");
  assert.equal(getNotificationRecipient("QUOTE", configuration), "company@example.test");
});

test("installed Nodemailer composes the application message shape without network access", async () => {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  const result = await transport.sendMail({
    from: { name: "X Dental Store", address: "notifications@example.test" },
    to: "company@example.test",
    replyTo: "clinic@example.test",
    subject: "New X Dental Store request",
    text: "A customer submitted a request.",
    html: "<p>A customer submitted a request.</p>",
  });
  const message = result.message.toString("utf8");

  assert.match(message, /Subject: New X Dental Store request/);
  assert.match(message, /company@example\.test/);
  assert.match(message, /clinic@example\.test/);
});

test("disabled mail persists DISABLED and never contacts SMTP", async () => {
  const database = createDatabase();
  let transportCalls = 0;
  const configuration = readMailConfiguration(mailEnvironment({ MAIL_ENABLED: "false" }));

  const result = await createSubmissionEmailDelivery({
    category: "CONTACT",
    entityId: "contact-1",
    payload: { name: "Clinic", message: "Please call us." },
    replyTo: "clinic@example.test",
    database,
    configuration,
    transport: { sendMail: async () => { transportCalls += 1; } },
  });

  assert.equal(result.delivery.status, "DISABLED");
  assert.equal(result.reason, "disabled");
  assert.equal(transportCalls, 0);
});

test("successful SMTP sends branded HTML/text and marks SENT", async () => {
  const database = createDatabase();
  const sentMessages = [];
  const configuration = readMailConfiguration(mailEnvironment());

  const result = await createSubmissionEmailDelivery({
    category: "CONTACT",
    entityId: "contact-2",
    payload: {
      reference: "contact-2",
      name: "Clinic",
      email: "clinic@example.test",
      message: "Need a quotation.",
      adminPath: "/admin/support",
    },
    replyTo: "clinic@example.test",
    database,
    configuration,
    transport: { sendMail: async (message) => sentMessages.push(message) },
  });

  assert.equal(result.delivery.status, "SENT");
  assert.equal(sentMessages.length, 1);
  assert.deepEqual(sentMessages[0].from, {
    name: "X Dental Store",
    address: "notifications@example.test",
  });
  assert.equal(sentMessages[0].to, "contact@example.test");
  assert.equal(sentMessages[0].replyTo, "clinic@example.test");
  assert.match(sentMessages[0].subject, /New contact message/);
  assert.match(sentMessages[0].html, /X Dental Store/);
  assert.match(sentMessages[0].text, /Need a quotation/);
});

test("SMTP failure stores sanitized FAILED state and retry reuses the record", async () => {
  const database = createDatabase();
  const configuration = readMailConfiguration(mailEnvironment());

  const failed = await createSubmissionEmailDelivery({
    category: "QUOTE",
    entityId: "quote-1",
    payload: { reference: "QT-1", name: "Clinic", message: "Quote request" },
    replyTo: "clinic@example.test",
    database,
    configuration,
    transport: {
      sendMail: async () => {
        throw new Error("authentication failed password=super-secret-password");
      },
    },
  });

  assert.equal(failed.delivery.status, "FAILED");
  assert.doesNotMatch(failed.delivery.errorMessage, /super-secret-password/);

  const retried = await retryEmailDelivery(failed.delivery.id, {
    database,
    configuration,
    transport: { sendMail: async () => {} },
    now: new Date("2026-07-26T10:05:00.000Z"),
  });

  assert.equal(retried.delivery.status, "SENT");
  assert.equal(retried.delivery.retryCount, 1);
  assert.equal(database.records.size, 1);
});

test("enabled mail fails configuration validation without exposing SMTP_PASS", () => {
  assert.throws(
    () =>
      validateMailConfiguration(
        mailEnvironment({
          SMTP_HOST: "",
          SMTP_USER: "",
          SMTP_PASS: "",
        })
      ),
    (error) => {
      assert.match(error.message, /SMTP_HOST/);
      assert.match(error.message, /SMTP_USER/);
      assert.match(error.message, /SMTP_PASS/);
      assert.doesNotMatch(error.message, /super-secret-password/);
      return true;
    }
  );
});
