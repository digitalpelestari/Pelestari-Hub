// public/sw.js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Notifikasi Baru', body: 'Pesan baru masuk.' };

  const options = {
    body: data.body,
    icon: '/icon-192x192.png', // sesuaikan dengan icon di public
    badge: '/badge-72x72.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});