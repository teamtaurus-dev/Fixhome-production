// FixHome Service Worker - v23-unified (Network-First Navigation & Dynamic Cache Busting)
const CACHE_NAME = "fixhome-app-v23-unified";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/fixhome_logo.jpg",
  "/favicon.png",
  "/icon.png"
];

// Install Event: Pre-cache essential static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("SW install cache.addAll warning:", err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clean up all older cache versions immediately and claim all clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("Cleaning up old SW cache:", name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Message Event: Allow clients to prompt skip waiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch Event: Network-first for navigation & API, Cache-first with revalidate for hashed assets
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never cache API calls or dynamic database endpoints
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (HTML document): Network-First with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match("/index.html").then((cachedIndex) => {
            return cachedIndex || caches.match("/");
          });
        })
    );
    return;
  }

  // Static Assets: For hashed /assets/*, Cache-First; for others, Network-First with cache fallback
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Other static files (images, manifest, icons): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Push Notification Click Event Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Push Event Handler for Background Alerts
self.addEventListener("push", (event) => {
  let data = { title: "FixHome Notification", body: "New booking update received." };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "FixHome Alert", body: event.data.text() };
    }
  }
  const options = {
    body: data.body,
    icon: "/fixhome_logo.jpg",
    badge: "/fixhome_logo.jpg",
    vibrate: [300, 100, 300, 100, 300],
    data: { url: data.url || "/" },
    tag: data.tag || "fixhome-mobile-notification",
    renotify: true,
    requireInteraction: true
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});
