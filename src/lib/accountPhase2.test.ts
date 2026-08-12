import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Settings uses the dedicated account-action API instead of Support tickets", async () => {
  const [settings, accountService] = await Promise.all([
    source("../pages/account-settings.tsx"),
    source("../services/account.ts"),
  ]);

  assert.doesNotMatch(settings, /createSupportThread/);
  assert.match(settings, /getAccountActionRequests\(signal\)/);
  assert.match(settings, /createAccountActionRequest\(\{/);
  assert.match(settings, /cancelAccountActionRequest\(accountRequest\.id\)/);
  assert.match(accountService, /"\/account\/action-requests"/);
  assert.match(accountService, /\/cancel`/);
});

test("customer requests require explicit confirmation and display real status data", async () => {
  const settings = await source("../pages/account-settings.tsx");
  assert.match(settings, /confirmationText === "DELETE"/);
  assert.match(settings, /confirmation: isDelete \? "DELETE" : "DEACTIVATE"/);
  assert.match(settings, /accountRequest\.publicRequestNumber/);
  assert.match(settings, /accountRequestStatusLabel\(t, accountRequest\.status\)/);
  assert.match(settings, /accountRequest\.customerResponse/);
  assert.match(settings, /accountRequest\.canCancel/);
  assert.match(settings, /result\.created/);
  assert.match(settings, /accountRequestAlreadyActive/);
});

test("admin account requests have search, filters, safe actions, and an audit view", async () => {
  const [page, service, routes, workflow] = await Promise.all([
    source("../pages/admin/account-requests.tsx"),
    source("../services/adminAccountActionRequests.ts"),
    source("../App.tsx"),
    source("./accountRequestWorkflow.ts"),
  ]);

  assert.match(page, /setSearch/);
  assert.match(page, /setType/);
  assert.match(page, /setStatus/);
  assert.match(page, /availableAdminAccountRequestActions/);
  assert.match(page, /confirmationText === confirmation/);
  assert.match(page, /selected\.history\.map/);
  assert.match(page, /entry\.adminNote/);
  assert.match(page, /completionActionTranslationKey/);
  assert.match(page, /completionWarningTranslationPrefix/);
  assert.match(page, /approvalExplanation/);
  assert.match(workflow, /request\.status === "APPROVED"\) return \["COMPLETE"\]/);
  assert.match(
    workflow,
    /request\.status === "PENDING"[\s\S]*?return \["UNDER_REVIEW", "APPROVE", "REJECT"\]/
  );
  assert.match(service, /\/admin\/account-action-requests/);
  assert.match(routes, /path="\/admin\/account-requests"/);
  assert.match(routes, /ACCOUNT_REQUESTS_VIEW/);
});

test("English and Arabic include the complete customer and admin workflow copy", async () => {
  const [englishSource, arabicSource] = await Promise.all([
    source("../locales/en.json"),
    source("../locales/ar.json"),
  ]);
  const english = JSON.parse(englishSource);
  const arabic = JSON.parse(arabicSource);

  for (const locale of [english, arabic]) {
    const settings = locale.accountPages.settings;
    assert.ok(settings.accountRequestReason);
    assert.ok(settings.typeDeleteConfirmation);
    assert.ok(settings.accountRequestSubmitted);
    assert.deepEqual(
      Object.keys(settings.accountRequestStatuses).sort(),
      ["approved", "canceled", "completed", "pending", "rejected", "underReview"]
    );

    const admin = locale.admin.accountRequests;
    assert.ok(admin.searchPlaceholder);
    assert.ok(admin.privateNote);
    assert.ok(admin.confirmationLabel);
    assert.ok(admin.approvalExplanation);
    assert.ok(admin.approvedStateExplanation);
    assert.ok(admin.completeDeactivationAction);
    assert.ok(admin.completeDeletionAction);
    assert.ok(admin.deletionCompletionDescription);
    assert.match(admin.statuses.approved, /Awaiting Completion|بانتظار التنفيذ/);
    assert.equal(Object.keys(admin.statuses).length, 6);
    assert.equal(Object.keys(admin.lifecycles).length, 4);
  }

  assert.match(arabic.accountPages.settings.accountRequestSubmitted, /\p{Script=Arabic}/u);
  assert.match(arabic.admin.accountRequests.title, /\p{Script=Arabic}/u);
});

test("approved customer copy clearly distinguishes approval from completion", async () => {
  const [englishSource, arabicSource, settings] = await Promise.all([
    source("../locales/en.json"),
    source("../locales/ar.json"),
    source("../pages/account-settings.tsx"),
  ]);
  const english = JSON.parse(englishSource);
  const arabic = JSON.parse(arabicSource);

  assert.match(
    english.accountPages.settings.approvedDeactivationExplanation,
    /awaiting completion by an administrator/i
  );
  assert.match(
    english.accountPages.settings.approvedDeletionExplanation,
    /awaiting final completion/i
  );
  assert.match(
    arabic.accountPages.settings.approvedDeactivationExplanation,
    /\p{Script=Arabic}/u
  );
  assert.match(settings, /approvedCustomerExplanationTranslationKey/);
  assert.match(settings, /accountRequest\.status === "APPROVED"/);
});

test("admin notifications, attention count, refresh, and deep links are wired safely", async () => {
  const [layout, page, dropdown, service, controller] = await Promise.all([
    source("../pages/admin/_components/AdminLayout.tsx"),
    source("../pages/admin/account-requests.tsx"),
    source("../components/dental/NotificationDropdown.tsx"),
    source("../services/adminAccountActionRequests.ts"),
    source("../../server/src/controllers/notification.controller.js"),
  ]);

  assert.match(layout, /NotificationDropdown/);
  assert.match(layout, /accountRequestAttentionCount/);
  assert.match(layout, /ACCOUNT_REQUESTS_VIEW/);
  assert.match(service, /account-action-requests-attention-count/);
  assert.match(page, /requestedAccountRequestId\(location\)/);
  assert.match(page, /getAdminAccountActionRequest\(/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /window\.addEventListener\("focus"/);
  assert.match(page, /onClick=\{refreshRequests\}/);
  assert.match(dropdown, /ACCOUNT_REQUESTS_REFRESH_EVENT/);
  assert.match(dropdown, /viewAllHref/);
  assert.match(controller, /where:\s*\{\s*userId:\s*request\.user\.id\s*\}/);
});

test("account request layouts retain responsive mobile and desktop treatments", async () => {
  const [settings, admin] = await Promise.all([
    source("../pages/account-settings.tsx"),
    source("../pages/admin/account-requests.tsx"),
  ]);

  assert.match(settings, /sm:flex-row/);
  assert.match(settings, /xl:col-span-2/);
  assert.match(admin, /md:grid-cols/);
  assert.match(admin, /max-w-2xl/);
  assert.match(admin, /overflow-y-auto/);
});

test("account-request action modal uses a viewport-safe accessible portal", async () => {
  const admin = await source("../pages/admin/account-requests.tsx");

  assert.match(admin, /DialogPrimitive\.Portal/);
  assert.match(admin, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(admin, /sm:max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(admin, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(admin, /sticky top-0/);
  assert.match(admin, /sticky bottom-0/);
  assert.match(admin, /onOpenAutoFocus/);
  assert.match(admin, /onCloseAutoFocus/);
  assert.match(admin, /onEscapeKeyDown/);
  assert.match(admin, /if \(isSaving\) event\.preventDefault\(\)/);
  assert.match(admin, /returnFocus\.focus\(\)/);
});

test("reactivation is limited to completed deactivations and explains fresh sign-in", async () => {
  const [workflow, page, englishSource, arabicSource] = await Promise.all([
    source("./accountRequestWorkflow.ts"),
    source("../pages/admin/account-requests.tsx"),
    source("../locales/en.json"),
    source("../locales/ar.json"),
  ]);
  const english = JSON.parse(englishSource);
  const arabic = JSON.parse(arabicSource);

  assert.match(
    workflow,
    /request\.status === "COMPLETED"[\s\S]*request\.type === "DEACTIVATION"[\s\S]*return \["REACTIVATE"\]/
  );
  assert.match(page, /action === "REACTIVATE"/);
  assert.match(page, /confirmationText === confirmation/);
  assert.match(english.admin.accountRequests.reactivationDescription, /Old sessions will not be restored/i);
  assert.match(english.admin.accountRequests.reactivationDescription, /sign in again/i);
  assert.match(arabic.admin.accountRequests.reactivateAction, /\p{Script=Arabic}/u);
  assert.equal(
    english.admin.accountRequests.permanentlyDeleted,
    "Permanently Deleted and Anonymized"
  );
});

test("customer and public sign-in surfaces provide generic Account Access Help", async () => {
  const [login, contact, settings, contactController, authController] =
    await Promise.all([
      source("../pages/login.tsx"),
      source("../pages/contact.tsx"),
      source("../pages/account-settings.tsx"),
      source("../../server/src/controllers/contact.controller.js"),
      source("../../server/src/controllers/auth.controller.js"),
    ]);

  assert.match(login, /t\("auth\.login\.invalidDescription"\)/);
  assert.match(login, /href="\/contact\?topic=account-access"/);
  assert.match(login, /link-account-access-help/);
  assert.match(contact, /hasAccountAccessTopic/);
  assert.match(contact, /contactPage\.accountAccess\.subjectValue/);
  assert.match(contact, /contactPage\.accountAccess\.successBody/);
  assert.match(contact, /source: "contact_page"/);
  assert.doesNotMatch(contactController, /findUnique\(\{\s*where:\s*\{\s*email/s);
  assert.match(settings, /completedDeactivationExplanation/);
  assert.match(authController, /Invalid email or password\./);
  assert.doesNotMatch(authController, /deactivated account|deleted account/i);
});
