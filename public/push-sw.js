// Imported into the next-pwa generated service worker via workboxOptions.importScripts.
// Adds Web Push handlers; without these the SW silently drops every incoming push.
// Also tracks an unread badge counter (Badging API) so the home-screen icon
// shows a red dot/number, matching native-app expectations.

const BADGE_DB = 'dzz3-badge';
const BADGE_KEY = 'count';

function badgeDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BADGE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBadgeCount() {
  try {
    const db = await badgeDb();
    return await new Promise((resolve) => {
      const tx = db.transaction('kv').objectStore('kv').get(BADGE_KEY);
      tx.onsuccess = () => resolve(Number(tx.result) || 0);
      tx.onerror = () => resolve(0);
    });
  } catch { return 0; }
}

async function setBadgeCount(n) {
  try {
    const db = await badgeDb();
    await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(n, BADGE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
  } catch {}
}

async function applyBadge(n) {
  try {
    if (n > 0 && 'setAppBadge' in self.navigator) {
      await self.navigator.setAppBadge(n);
    } else if ('clearAppBadge' in self.navigator) {
      await self.navigator.clearAppBadge();
    }
  } catch {}
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
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
    await self.registration.showNotification(title, options);

    const next = (await getBadgeCount()) + 1;
    await setBadgeCount(next);
    await applyBadge(next);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    // Opening the app — treat as "user has seen pending notifications".
    await setBadgeCount(0);
    await applyBadge(0);

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

// Page can postMessage({ type: 'CLEAR_BADGE' }) when the user focuses the app
// inside the browser/PWA.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_BADGE') {
    event.waitUntil((async () => {
      await setBadgeCount(0);
      await applyBadge(0);
    })());
  }
});
