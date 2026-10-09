// GLB-020: service worker khusus notifikasi pengingat. Sengaja tanpa cache/offline:
// data kesehatan tidak boleh tersimpan di cache browser.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Pengingat Glubee", {
      body: data.body || "Ada jadwal yang jatuh tempo.",
      icon: "/icon.png",
      badge: "/icon.png",
      tag: data.tag,
      lang: "id",
      data: { url: data.url || "/schedule" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/schedule", self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === url.origin && "focus" in client) {
          client.navigate(url.href);
          return client.focus();
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
