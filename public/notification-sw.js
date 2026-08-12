self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function safeNotificationLink(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : "X Dental Store";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body.trim()
      : "You have a new account update.";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: new URL("navbar-logo-icon.png", self.registration.scope).href,
      badge: new URL("navbar-logo-icon.png", self.registration.scope).href,
      tag:
        typeof payload.tag === "string" && payload.tag.trim()
          ? payload.tag.trim()
          : "x-dental-account-update",
      data: { link: safeNotificationLink(payload.link) },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = safeNotificationLink(event.notification.data?.link);
  const destination = new URL(link, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        for (const client of windows) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          await client.navigate(destination);
          return client.focus();
        }
        return self.clients.openWindow(destination);
      })
  );
});
