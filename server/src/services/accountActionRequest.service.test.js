import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountActionValidationError,
  cancelCustomerAccountActionRequest,
  countAdminAccountActionRequestsNeedingAttention,
  createAdminManagedAccountActionRequest,
  createAnonymizedIdentityHash,
  createCustomerAccountActionRequest,
  getCustomerAccountActionRequest,
  processAdminAccountAction,
  assertAccountRemovalTargetAllowed,
  validateAdminActionPayload,
  validateCustomerActionRequestPayload,
} from "./accountActionRequest.service.js";
import { sendAccountActionEmail } from "./accountActionCommunication.service.js";
import { isLoginEligibleUser } from "../controllers/auth.controller.js";

const now = new Date("2026-07-30T12:00:00.000Z");

function customer(overrides = {}) {
  return {
    id: "customer-a",
    name: "Customer A",
    email: "customer-a@example.test",
    role: "CUSTOMER",
    isActive: true,
    lifecycleState: "ACTIVE",
    accountPreference: { language: "EN" },
    ...overrides,
  };
}

function accountRequest(overrides = {}) {
  return {
    id: "request-a",
    publicRequestNumber: "AR-20260730-AAAA0001",
    userId: "customer-a",
    type: "DEACTIVATION",
    status: "PENDING",
    customerReason: null,
    customerDetails: null,
    submittedAt: now,
    updatedAt: now,
    reviewedAt: null,
    reviewedByUserId: null,
    customerResponse: null,
    reviewerNote: null,
    completedAt: null,
    canceledAt: null,
    cancellationReason: null,
    completionReference: null,
    ...overrides,
  };
}

function createAdminWorkflowDatabase(initialRequest) {
  let request = { ...initialRequest };
  let user = { ...initialRequest.user };
  const calls = {
    userUpdates: [],
    sessionUpdates: [],
    pushDeletes: [],
    locationDeletes: [],
    newsletterDeletes: [],
    requestUpdates: [],
    historyCreates: [],
    notifications: [],
    orderMutations: 0,
    supportMutations: 0,
  };

  const transaction = {
    accountActionRequest: {
      findUnique: async ({ include }) => {
        if (include?.history) {
          return {
            ...request,
            user,
            reviewedBy: null,
            history: calls.historyCreates.map((data, index) => ({
              id: `history-${index + 1}`,
              ...data,
              actor: { name: "Admin", email: "admin@example.test" },
            })),
          };
        }
        return { ...request, user };
      },
      update: async ({ data }) => {
        calls.requestUpdates.push(data);
        request = { ...request, ...data, updatedAt: now };
        return request;
      },
    },
    user: {
      update: async ({ data }) => {
        calls.userUpdates.push(data);
        user = { ...user, ...data };
        return user;
      },
    },
    authSession: {
      updateMany: async (input) => {
        calls.sessionUpdates.push(input);
        return { count: 2 };
      },
    },
    pushSubscription: {
      deleteMany: async (input) => {
        calls.pushDeletes.push(input);
        return { count: 1 };
      },
    },
    userClinicLocation: {
      deleteMany: async (input) => {
        calls.locationDeletes.push(input);
        return { count: 1 };
      },
    },
    newsletterSubscriber: {
      deleteMany: async (input) => {
        calls.newsletterDeletes.push(input);
        return { count: 1 };
      },
    },
    accountActionRequestHistory: {
      create: async ({ data }) => {
        calls.historyCreates.push(data);
        return data;
      },
    },
    notification: {
      create: async ({ data }) => {
        const notification = { id: `notification-${calls.notifications.length + 1}`, ...data };
        calls.notifications.push(notification);
        return notification;
      },
    },
    order: new Proxy({}, {
      get() {
        calls.orderMutations += 1;
        throw new Error("Orders must not be touched by account processing.");
      },
    }),
    supportThread: new Proxy({}, {
      get() {
        calls.supportMutations += 1;
        throw new Error("Support records must not be touched by account processing.");
      },
    }),
  };

  return {
    database: { $transaction: async (callback) => callback(transaction) },
    calls,
    currentUser: () => user,
  };
}

test("customer creation validates explicit confirmation and rejects unexpected fields", () => {
  assert.throws(
    () => validateCustomerActionRequestPayload({ type: "DELETION", confirmation: "yes" }),
    (error) =>
      error instanceof AccountActionValidationError
      && error.code === "CONFIRMATION_REQUIRED"
  );
  assert.throws(
    () =>
      validateCustomerActionRequestPayload({
        type: "DEACTIVATION",
        confirmation: "DEACTIVATE",
        userId: "customer-b",
      }),
    /Unexpected field: userId/
  );
});

test("creates a customer-scoped request with audit history and customer/staff notifications", async () => {
  const calls = {
    create: null,
    notification: null,
    lifecycle: null,
    staffQuery: null,
    staffNotifications: [],
  };
  const database = {
    $transaction: async (callback) =>
      callback({
        user: {
          findUnique: async ({ where }) => {
            assert.deepEqual(where, { id: "customer-a" });
            return customer();
          },
          update: async ({ data }) => {
            calls.lifecycle = data;
          },
          findMany: async (input) => {
            calls.staffQuery = input;
            return [{ id: "admin-a" }, { id: "support-permitted" }];
          },
        },
        accountActionRequest: {
          findFirst: async ({ where }) => {
            assert.equal(where.userId, "customer-a");
            assert.equal(where.type, "DELETION");
            return null;
          },
          create: async ({ data }) => {
            calls.create = data;
            return accountRequest({ ...data, id: "request-created", status: "PENDING" });
          },
        },
        notification: {
          create: async ({ data }) => {
            calls.notification = data;
            return { id: "notification-a", ...data };
          },
          findMany: async () => [],
          createMany: async ({ data }) => {
            calls.staffNotifications.push(...data);
            return { count: data.length };
          },
        },
      }),
  };

  const result = await createCustomerAccountActionRequest(
    {
      userId: "customer-a",
      payload: {
        type: "DELETION",
        confirmation: "DELETE",
        customerReason: "No longer needed",
      },
      now,
      requestNumber: "AR-20260730-AAAA0002",
    },
    database
  );

  assert.equal(result.created, true);
  assert.equal(result.request.status, "PENDING");
  assert.equal(calls.create.userId, "customer-a");
  assert.equal(calls.create.history.create.actorUserId, "customer-a");
  assert.equal(calls.create.history.create.newLifecycle, "DELETION_REQUESTED");
  assert.equal(calls.lifecycle.lifecycleState, "DELETION_REQUESTED");
  assert.equal(calls.notification.metadata.mandatory, true);
  assert.equal(calls.notification.type, "ACCOUNT");
  assert.equal(
    calls.staffQuery.where.OR[1].permissions.some.permission.key,
    "ACCOUNT_LIFECYCLE_VIEW"
  );
  assert.deepEqual(
    calls.staffNotifications.map(({ userId }) => userId),
    ["admin-a", "support-permitted"]
  );
  assert.equal(
    calls.staffNotifications[0].metadata.dedupeKey,
    "account-action:request-created:SUBMITTED"
  );
  assert.equal(
    calls.staffNotifications[0].link,
    "/admin/account-requests?request=request-created"
  );
  assert.equal(
    Object.hasOwn(calls.staffNotifications[0].metadata, "customerReason"),
    false
  );
});

test("returns the existing active request instead of creating a duplicate of the same type", async () => {
  const existing = accountRequest({ type: "DELETION", status: "UNDER_REVIEW" });
  let createCalled = false;
  const database = {
    $transaction: async (callback) =>
      callback({
        user: { findUnique: async () => customer() },
        accountActionRequest: {
          findFirst: async () => existing,
          create: async () => {
            createCalled = true;
          },
        },
      }),
  };

  const result = await createCustomerAccountActionRequest(
    {
      userId: "customer-a",
      payload: { type: "DELETION", confirmation: "DELETE" },
      now,
    },
    database
  );

  assert.equal(result.created, false);
  assert.equal(result.request.id, existing.id);
  assert.equal(createCalled, false);
});

test("customer detail and cancellation queries always include authenticated ownership", async () => {
  let detailWhere;
  const detail = await getCustomerAccountActionRequest(
    { userId: "customer-a", requestId: "request-a" },
    {
      accountActionRequest: {
        findFirst: async ({ where }) => {
          detailWhere = where;
          return accountRequest();
        },
      },
    }
  );
  assert.equal(detail.id, "request-a");
  assert.deepEqual(detailWhere, { id: "request-a", userId: "customer-a" });

  let cancelWhere;
  const staffNotifications = [];
  const cancellationDatabase = {
    $transaction: async (callback) =>
      callback({
        accountActionRequest: {
          findFirst: async ({ where }) => {
            cancelWhere = where;
            return accountRequest({ type: "DELETION" });
          },
          update: async ({ data }) =>
            accountRequest({ type: "DELETION", ...data }),
        },
        user: {
          findUnique: async () =>
            customer({ lifecycleState: "DELETION_REQUESTED" }),
          update: async () => ({}),
          findMany: async () => [{ id: "admin-a" }],
        },
        notification: {
          create: async ({ data }) => ({ id: "notification-a", ...data }),
          findMany: async () => [],
          createMany: async ({ data }) => {
            staffNotifications.push(...data);
            return { count: data.length };
          },
        },
      }),
  };
  const canceled = await cancelCustomerAccountActionRequest(
    {
      userId: "customer-a",
      requestId: "request-a",
      payload: { cancellationReason: "Changed my mind" },
      now,
    },
    cancellationDatabase
  );
  assert.deepEqual(cancelWhere, { id: "request-a", userId: "customer-a" });
  assert.equal(canceled.request.status, "CANCELED");
  assert.equal(staffNotifications.length, 1);
  assert.equal(
    staffNotifications[0].metadata.dedupeKey,
    "account-action:request-a:CANCELED"
  );
});

test("attention count includes only requests that still need staff action", async () => {
  let countWhere;
  const count = await countAdminAccountActionRequestsNeedingAttention({
    accountActionRequest: {
      count: async ({ where }) => {
        countWhere = where;
        return 3;
      },
    },
  });

  assert.equal(count, 3);
  assert.deepEqual(countWhere, {
    status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
  });
});

test("customers cannot cancel a reviewed or approved request", async () => {
  const database = {
    $transaction: async (callback) =>
      callback({
        accountActionRequest: {
          findFirst: async () => accountRequest({ status: "APPROVED" }),
        },
      }),
  };
  await assert.rejects(
    cancelCustomerAccountActionRequest(
      { userId: "customer-a", requestId: "request-a", payload: {}, now },
      database
    ),
    (error) =>
      error instanceof AccountActionValidationError
      && error.code === "CANCELLATION_NOT_ALLOWED"
  );
});

test("admin transitions require confirmation and reject invalid completion paths", async () => {
  assert.throws(
    () => validateAdminActionPayload({ action: "APPROVE" }),
    (error) => error.code === "CONFIRMATION_REQUIRED"
  );
  const request = accountRequest({ status: "PENDING", user: customer() });
  const { database } = createAdminWorkflowDatabase(request);
  await assert.rejects(
    processAdminAccountAction(
      {
        requestId: request.id,
        actor: { id: "admin-a", role: "admin" },
        payload: {
          action: "COMPLETE",
          confirmation: "COMPLETE",
          customerResponse: "We reviewed your request.",
          adminNote: "Protected review completed.",
        },
        now,
      },
      database
    ),
    (error) =>
      error instanceof AccountActionValidationError
      && error.code === "INVALID_TRANSITION"
  );
});

test("deactivation completion makes the account inactive, revokes sessions, and audits the actor", async () => {
  const request = accountRequest({
    status: "APPROVED",
    user: customer(),
  });
  const { database, calls, currentUser } = createAdminWorkflowDatabase(request);
  const result = await processAdminAccountAction(
    {
      requestId: request.id,
      actor: { id: "admin-a", role: "admin" },
      payload: {
        action: "COMPLETE",
        confirmation: "COMPLETE",
        customerResponse: "Your account has been deactivated.",
        adminNote: "Identity verified.",
      },
      now,
    },
    database
  );

  assert.equal(result.request.status, "COMPLETED");
  assert.equal(currentUser().isActive, false);
  assert.equal(currentUser().lifecycleState, "DEACTIVATED");
  assert.deepEqual(calls.sessionUpdates[0].where, {
    userId: "customer-a",
    revokedAt: null,
  });
  assert.equal(calls.sessionUpdates[0].data.revocationReason, "ACCOUNT_DEACTIVATED");
  assert.equal(calls.historyCreates[0].actorUserId, "admin-a");
  assert.equal(calls.historyCreates[0].previousStatus, "APPROVED");
  assert.equal(calls.historyCreates[0].newStatus, "COMPLETED");
  assert.equal(calls.notifications[0].metadata.mandatory, true);
  assert.equal(calls.orderMutations, 0);
  assert.equal(calls.supportMutations, 0);
});

test("reactivation restores eligibility without restoring any old session", async () => {
  const request = accountRequest({
    status: "COMPLETED",
    user: customer({ isActive: false, lifecycleState: "DEACTIVATED" }),
  });
  const { database, calls, currentUser } = createAdminWorkflowDatabase(request);
  await processAdminAccountAction(
    {
      requestId: request.id,
      actor: { id: "admin-a", role: "admin" },
      payload: {
        action: "REACTIVATE",
        confirmation: "REACTIVATE",
        customerResponse: "Your account is available for a fresh sign-in.",
        adminNote: "Approved reactivation.",
      },
      now,
    },
    database
  );

  assert.equal(currentUser().isActive, true);
  assert.equal(currentUser().lifecycleState, "ACTIVE");
  assert.equal(calls.sessionUpdates.length, 0);
  assert.equal(calls.historyCreates[0].eventType, "REACTIVATED");
  assert.equal(isLoginEligibleUser(currentUser()), true);
});

test("deletion completion anonymizes profile identity while preserving transactional relations", async () => {
  const request = accountRequest({
    type: "DELETION",
    status: "APPROVED",
    user: customer({
      lifecycleState: "DELETION_REQUESTED",
      profileImageUrl: "/uploads/profile/customer-a.webp",
    }),
  });
  const { database, calls, currentUser } = createAdminWorkflowDatabase(request);
  const result = await processAdminAccountAction(
    {
      requestId: request.id,
      actor: { id: "admin-a", role: "admin" },
      payload: {
        action: "COMPLETE",
        confirmation: "COMPLETE",
        customerResponse: "Your deletion request has been completed.",
        adminNote: "Retention requirements reviewed.",
      },
      now,
      environment: { JWT_SECRET: "unit-test-secret-with-sufficient-entropy" },
    },
    database
  );

  const deleted = currentUser();
  assert.equal(deleted.isActive, false);
  assert.equal(deleted.lifecycleState, "DELETED");
  assert.equal(deleted.name, "Deleted customer");
  assert.match(deleted.email, /^deleted-.+@anonymized\.invalid$/);
  assert.equal(deleted.phone, null);
  assert.equal(deleted.clinicName, null);
  assert.equal(deleted.profileImageUrl, null);
  assert.match(deleted.passwordHash, /^\$2[aby]\$/);
  assert.equal(
    deleted.anonymizedIdentityHash,
    createAnonymizedIdentityHash(
      "customer-a@example.test",
      "unit-test-secret-with-sufficient-entropy"
    )
  );
  assert.equal(calls.sessionUpdates[0].data.revocationReason, "ACCOUNT_DELETED");
  assert.equal(calls.pushDeletes.length, 1);
  assert.equal(calls.locationDeletes.length, 1);
  assert.equal(calls.orderMutations, 0);
  assert.equal(calls.supportMutations, 0);
  assert.equal(isLoginEligibleUser(deleted), false);
  assert.equal(
    result.profileImageUrlToDelete,
    "/uploads/profile/customer-a.webp"
  );
});

test("admin-managed customer lifecycle initiation is protected and audited", async () => {
  const calls = { created: null, history: null, notification: null };
  const activeCustomer = customer();
  const transaction = {
    user: {
      findUnique: async () => activeCustomer,
      update: async () => activeCustomer,
    },
    accountActionRequest: {
      findFirst: async () => null,
      create: async ({ data }) => {
        calls.created = data;
        calls.history = data.history.create;
        return accountRequest({
          ...data,
          id: "request-admin-created",
          user: undefined,
        });
      },
      findUnique: async () => ({
        ...accountRequest({ id: "request-admin-created" }),
        user: activeCustomer,
        reviewedBy: null,
        history: [{ id: "history-1", ...calls.history, actor: null }],
      }),
    },
    accountActionRequestHistory: { create: async () => undefined },
    notification: {
      create: async ({ data }) => {
        calls.notification = data;
        return { id: "notification-1", ...data };
      },
    },
  };
  const result = await createAdminManagedAccountActionRequest(
    {
      userId: activeCustomer.id,
      actor: { id: "admin-a", role: "admin" },
      payload: {
        type: "DEACTIVATION",
        confirmation: "INITIATE_DEACTIVATION",
        customerResponse: "We have started the protected deactivation review.",
        adminNote: "Customer identity and request were verified.",
      },
      now,
      requestNumber: "AR-20260730-ADMIN001",
    },
    { $transaction: async (callback) => callback(transaction) }
  );

  assert.equal(result.created, true);
  assert.equal(calls.created.type, "DEACTIVATION");
  assert.equal(calls.history.actorUserId, "admin-a");
  assert.equal(calls.history.adminNote, "Customer identity and request were verified.");
  assert.equal(calls.notification.metadata.mandatory, true);
});

test("admin self-removal and last-active-admin removal are blocked", async () => {
  await assert.rejects(
    assertAccountRemovalTargetAllowed(
      { user: { count: async () => 2 } },
      {
        actor: { id: "admin-a" },
        target: { id: "admin-a", role: "ADMIN", isActive: true },
      }
    ),
    (error) => error.code === "SELF_REMOVAL_BLOCKED"
  );

  await assert.rejects(
    assertAccountRemovalTargetAllowed(
      { user: { count: async () => 1 } },
      {
        actor: { id: "admin-b" },
        target: { id: "admin-a", role: "ADMIN", isActive: true },
      }
    ),
    (error) => error.code === "LAST_ADMIN_PROTECTED"
  );
});

test("completed deletion is irreversible", async () => {
  const request = accountRequest({
    type: "DELETION",
    status: "COMPLETED",
    user: customer({ isActive: false, lifecycleState: "DELETED" }),
  });
  const { database } = createAdminWorkflowDatabase(request);
  await assert.rejects(
    processAdminAccountAction(
      {
        requestId: request.id,
        actor: { id: "admin-a", role: "admin" },
        payload: {
          action: "REACTIVATE",
          confirmation: "REACTIVATE",
          customerResponse: "This action must remain unavailable.",
          adminNote: "Irreversibility regression check.",
        },
        now,
      },
      database
    ),
    (error) => error.code === "DELETION_IRREVERSIBLE"
  );
});

test("login eligibility rejects deactivated and deleted users but preserves active behavior", () => {
  assert.equal(isLoginEligibleUser(customer()), true);
  assert.equal(
    isLoginEligibleUser(customer({ lifecycleState: "DELETION_REQUESTED" })),
    true
  );
  assert.equal(
    isLoginEligibleUser(customer({ isActive: false, lifecycleState: "DEACTIVATED" })),
    false
  );
  assert.equal(
    isLoginEligibleUser(customer({ isActive: false, lifecycleState: "DELETED" })),
    false
  );
});

test("disabled mail skips SMTP creation while in-app behavior remains independent", async () => {
  let transportCreated = false;
  const result = await sendAccountActionEmail(
    {
      recipient: "customer-a@example.test",
      title: "Account update",
      body: "Your request changed.",
    },
    {
      configuration: { enabled: false },
      createTransport: () => {
        transportCreated = true;
      },
    }
  );

  assert.deepEqual(result, { enabled: false, sent: false, skipped: true });
  assert.equal(transportCreated, false);
});
