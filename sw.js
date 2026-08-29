// Service Worker for Newborn NEWS (PWA & Mobile Notifications)
const CACHE_NAME = "newborn-news-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("Cache addAll error:", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache with network fallback
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Don't intercept API requests
  if (url.pathname.includes("/api/")) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alertData = event.notification.data;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (alertData && client.postMessage) {
            client.postMessage({ type: "OPEN_ALERT", data: alertData });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("./");
      }
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "⚠️ Newborn NEWS: สัญญาณเตือนภาวะวิกฤต",
    body: "พบค่าสัญญาณชีพผิดปกติ กรุณาเปิดดูรายละเอียด",
    tag: "newborn-news-alert",
    requireInteraction: true,
    data: null
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload.title = parsed.title || payload.title;
      payload.body = parsed.body || payload.body;
      payload.tag = parsed.tag || payload.tag;
      payload.data = parsed.data || null;
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      tag: payload.tag || `newborn-news-${Date.now()}`,
      requireInteraction: true,
      silent: false,
      vibrate: [300, 100, 300, 100, 300],
      actions: [
        { action: "view", title: "🔍 เปิดดูรายละเอียด" }
      ],
      data: payload.data
    })
  );
});