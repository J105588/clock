const CACHE_NAME = 'clock-v10';
const ASSETS = [
  './',
  './index.html',
  './icon.png'
];

// インストールイベント: アセットをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ブラウザのHTTPキャッシュをバイパスして最新アセットを取得・格納
      return Promise.all(
        ASSETS.map((url) => {
          return fetch(url, { cache: 'reload' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
              throw new Error(`Failed to fetch ${url}`);
            });
        })
      );
    })
  );
  self.skipWaiting();
});

// アクティベーションイベント: 古いキャッシュの削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

// フェッチイベント
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // index.html またはルート（/）へのリクエストは Network-First
  const isHtmlRequest = e.request.mode === 'navigate' ||
    (url.origin === self.location.origin &&
      (url.pathname === '/' || url.pathname.endsWith('index.html')));

  if (isHtmlRequest) {
    const fetchRequest = new Request(e.request.url, { cache: 'no-cache' });
    e.respondWith(
      fetch(fetchRequest)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cacheCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
          }
          return networkResponse;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す（キャッシュミスの場合はルートまたはindex.htmlをフォールバック）
          return caches.match(e.request).then((response) => {
            if (response) return response;
            return caches.match('./index.html').then((fallback) => {
              return fallback || caches.match('./');
            });
          });
        })
    );
  } else {
    // 画像などの静的アセットは Stale-While-Revalidate
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        const fetchPromise = fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheCopy));
            }
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
