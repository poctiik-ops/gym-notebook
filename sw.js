/*
 * Service worker: офлайн-оболочка приложения.
 * При изменении любого файла увеличьте VERSION — иначе телефон продолжит показывать старую версию.
 */
const VERSION = 'v1';
const CACHE = `gym-notebook-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/domain.js',
  './js/seed.js',
  './js/db.js',
  './js/platform.js',
  './js/ui.js',
  './js/screens/today.js',
  './js/screens/workout.js',
  './js/screens/program.js',
  './js/screens/other.js',
  './js/app.js',
  './icons/favicon.svg',
  './icons/apple-touch-icon.png',
  './icons/pwa-192x192.png',
  './icons/pwa-512x512.png',
  './icons/maskable-512x512.png',
];

self.addEventListener('install', (event) => {
  // Новая версия ждёт, пока пользователь не нажмёт «Обновить» (не посреди тренировки)
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gym-notebook-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Страница: оболочка из кэша (работает без сети)
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(req)));
    return;
  }

  // Остальное: кэш, затем сеть
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
