// Firebase Messaging Service Worker for Background Push Notifications
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDF-7MYIN2Q7edWkCVpWzlWN3Khah6UCVg",
  authDomain: "quick-services-fsebmv.firebaseapp.com",
  projectId: "quick-services-fsebmv",
  storageBucket: "quick-services-fsebmv.firebasestorage.app",
  messagingSenderId: "759211290458",
  appId: "1:759211290458:web:3cba99a6d1c5a2aea44d63"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'FixHome Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new service update from FixHome.',
    icon: '/fixhome_logo.jpg',
    badge: '/fixhome_logo.jpg',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Native Push Event listener fallback for closed browser tabs / native push payloads
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.notification?.title || data.title || 'FixHome Alert';
  const options = {
    body: data.notification?.body || data.body || 'New update received from FixHome',
    icon: '/fixhome_logo.jpg',
    badge: '/fixhome_logo.jpg',
    data: data.data || data,
    vibrate: [200, 100, 200],
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
