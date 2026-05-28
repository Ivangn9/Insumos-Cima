importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

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

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || '📬 Nueva solicitud';
  const body  = payload.notification?.body  || '';

  _badgeCount++;

  // Globo numérico en el ícono de la app (iOS 16.4+ / Android)
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(_badgeCount).catch(()=>{});
  }

  self.registration.showNotification(title, {
    body,
    icon:    '/medtrack/Iconogestioninsumos.png',
    badge:   '/medtrack/Iconogestioninsumos.png',
    vibrate: [200, 100, 200, 100, 200],
    tag:     'solicitud-nueva',
    renotify: true,
    data:    { url: 'https://ivangn9.github.io/medtrack/stock-insumos.html', count: _badgeCount }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://ivangn9.github.io/medtrack/stock-insumos.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('stock-insumos') && 'focus' in c) return c.focus();
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
