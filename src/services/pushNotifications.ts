import { apiRequest } from "@/services/http";

const PUSH_OPT_IN_USER_KEY = "x-dental-push-opt-in-user-id";
const LEGACY_ENABLED_KEY = "x-dental-notification-enabled";

type PushConfiguration = {
  enabled: boolean;
  publicKey: string | null;
};

export type BrowserPushPreparation = {
  available: boolean;
  showPrompt: boolean;
  subscribed: boolean;
};

export type BrowserPushEnableResult =
  | "enabled"
  | "denied"
  | "dismissed"
  | "unavailable";

function readOptInUserId() {
  try {
    return window.localStorage.getItem(PUSH_OPT_IN_USER_KEY);
  } catch {
    return null;
  }
}

function writeOptInUserId(userId: string) {
  try {
    window.localStorage.setItem(PUSH_OPT_IN_USER_KEY, userId);
    window.localStorage.removeItem(LEGACY_ENABLED_KEY);
  } catch {
    // A subscription still works when storage is restricted; it just cannot
    // be restored automatically for the same account on the next sign-in.
  }
}

function pushIsSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function decodeApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function applicationServerKeysMatch(
  existing: ArrayBuffer | null,
  expected: Uint8Array
) {
  if (!existing) return false;
  const existingBytes = new Uint8Array(existing);
  return (
    existingBytes.length === expected.length &&
    existingBytes.every((value, index) => value === expected[index])
  );
}

function serviceWorkerLocation() {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return {
    scriptUrl: `${base}notification-sw.js`,
    scope: base,
  };
}

async function registerNotificationWorker() {
  const { scriptUrl, scope } = serviceWorkerLocation();
  return navigator.serviceWorker.register(scriptUrl, { scope });
}

async function unsubscribeCurrentBrowserEndpoint() {
  const registration = await navigator.serviceWorker.getRegistration(
    serviceWorkerLocation().scope
  );
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

async function readPushConfiguration() {
  return apiRequest<PushConfiguration>("/notifications/push/config");
}

async function ensureBrowserSubscription(publicKey: string) {
  const registration = await registerNotificationWorker();
  const applicationServerKey = decodeApplicationServerKey(publicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (
    subscription &&
    !applicationServerKeysMatch(
      subscription.options.applicationServerKey,
      applicationServerKey
    )
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await apiRequest<{ subscribed: true }>("/notifications/push/subscription", {
    method: "PUT",
    body: JSON.stringify(subscription.toJSON()),
  });
  return subscription;
}

export async function prepareBrowserPushForCustomer(
  userId: string
): Promise<BrowserPushPreparation> {
  if (!pushIsSupported()) {
    return { available: false, showPrompt: false, subscribed: false };
  }

  const configuration = await readPushConfiguration();
  if (!configuration.enabled || !configuration.publicKey) {
    return { available: false, showPrompt: false, subscribed: false };
  }

  if (window.Notification.permission === "denied") {
    return { available: true, showPrompt: false, subscribed: false };
  }

  if (window.Notification.permission !== "granted") {
    return { available: true, showPrompt: true, subscribed: false };
  }

  if (readOptInUserId() !== userId) {
    // A different account must explicitly opt in. Invalidating the previous
    // browser endpoint also prevents account A's alerts appearing for account B
    // if the browser session changed without the normal logout flow.
    await unsubscribeCurrentBrowserEndpoint();
    return { available: true, showPrompt: true, subscribed: false };
  }

  await ensureBrowserSubscription(configuration.publicKey);
  return { available: true, showPrompt: false, subscribed: true };
}

export async function enableBrowserPushForCustomer(
  userId: string
): Promise<BrowserPushEnableResult> {
  if (!pushIsSupported()) return "unavailable";

  const configuration = await readPushConfiguration();
  if (!configuration.enabled || !configuration.publicKey) return "unavailable";

  let permission = window.Notification.permission;
  if (permission === "default") {
    permission = await window.Notification.requestPermission();
  }
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "dismissed";

  await ensureBrowserSubscription(configuration.publicKey);
  writeOptInUserId(userId);
  return "enabled";
}

export async function disconnectBrowserPushForCustomer() {
  if (!pushIsSupported()) return;

  const registration = await navigator.serviceWorker.getRegistration(
    serviceWorkerLocation().scope
  );
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await apiRequest<{ unsubscribed: true }>(
      "/notifications/push/subscription",
      {
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }
    );
  } finally {
    await subscription.unsubscribe();
  }
}
