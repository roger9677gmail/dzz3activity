// Imported into the next-pwa generated service worker via workboxOptions.importScripts.
// Adds Web Push handlers; without these the SW silently drops every incoming push.

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); }
    catch { data = { title: '大自在山活動', body: event.data.text() }; }
  }
  const title = data.title || '大自在山活動';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      try {
        await c.focus();
        if ('navigate' in c) await c.navigate(target);
        return;
      } catch {}
    }
    await self.clients.openWindow(target);
  })());
});
