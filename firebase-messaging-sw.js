importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ── Auto-update: keep this in sync with APP_VERSION in stock-insumos.html ────
const APP_VERSION = '6.0';
const CACHE_NAME  = 'cima-' + APP_VERSION;

// Activate the new SW immediately — don't wait for tabs to close
self.addEventListener('install', event => {
  self.skipWaiting();
});

// On activation: clear ALL old caches and claim open pages right away
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim().then(async () => {
        // Tell every open tab to reload so it picks up the new HTML
        const all = await self.clients.matchAll({ type: 'window' });
        all.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: APP_VERSION }));
      })
    ])
  );
});

// ── Cache del app shell: apertura instantánea ─────────────────────────────────────────────
// SOLO se cachean los archivos de Stock de Insumos y sus librerías CDN.
// Cualquier otra URL (pedido-insumos.html, Firestore, Auth, FCM) pasa
// directo a la red sin tocarse.
const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];
const LOCAL_ASSETS = /\/(stock-insumos\.html|manifest-insumos\.json|logo\.png|Fondo\.png|Iconogestioninsumos\.png)$/;

function _isCacheable(url) {
  if (url.origin === self.location.origin) return LOCAL_ASSETS.test(url.pathname);
  return CDN_ASSETS.includes(url.href);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Chequeos de versión y recargas forzadas siempre van a la red
  if (url.searchParams.has('_nocache') || url.searchParams.has('_sw')) return;
  if (!_isCacheable(url)) return;
  // Stale-while-revalidate: respuesta instantánea desde cache + refresco en
  // segundo plano. El bump de APP_VERSION borra el cache viejo entero.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    const network = fetch(event.request).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) cache.put(event.request, resp.clone());
      return resp;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});

// ── Firebase Cloud Messaging ────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyDpzlN1gaJUH6XGAWv5GRW_suk7zcqKeJE",
  authDomain: "medtrack-cima-3e9c1.firebaseapp.com",
  projectId: "medtrack-cima-3e9c1",
  storageBucket: "medtrack-cima-3e9c1.firebasestorage.app",
  messagingSenderId: "110780335014",
  appId: "1:110780335014:web:b991d26e01637bdc884567"
});

const messaging = firebase.messaging();

// Contador de notificaciones no leídas en el globo del ícono
let _badgeCount = 0;

messaging.onBackgroundMessage(async payload => {
  // Si la app está visible en primer plano, el banner in-app ya cubre la notificación
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appVisible = windowClients.some(c =>
    c.url.includes('stock-insumos') && c.visibilityState === 'visible'
  );
  if (appVisible) return;

  const title = payload.notification?.title || '📬 Nueva solicitud';
  const body  = payload.notification?.body  || '';

  _badgeCount++;

  // Globo numérico en el ícono de la app (iOS 16.4+ / Android)
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(_badgeCount).catch(()=>{});
  }

  self.registration.showNotification(title, {
    body,
    icon:    '/Insumos-Cima/Iconogestioninsumos.png',
    badge:   '/Insumos-Cima/Iconogestioninsumos.png',
    vibrate: [200, 100, 200, 100, 200],
    tag:     'solicitud-nueva',
    renotify: true,
    data:    { url: 'https://ivangn9.github.io/Insumos-Cima/stock-insumos.html?tab=solicitudes', count: _badgeCount }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://ivangn9.github.io/Insumos-Cima/stock-insumos.html?tab=solicitudes';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('stock-insumos') && 'focus' in c) {
          c.postMessage({ type: 'switchTab', tab: 'solicitudes' });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Limpiar globo cuando el usuario abre la app
self.addEventListener('message', event => {
  if (event.data === 'clearBadge') {
    _badgeCount = 0;
    if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge().catch(()=>{});
    }
  }
});
