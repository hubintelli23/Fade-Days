/*
 * Fade & Days 서비스 워커 (웹앱 오프라인 지원)
 *
 * - 앱 화면(HTML·JS·CSS·아이콘): 캐시에 저장해 두고 인터넷이 없어도 열리게 한다
 * - 페이지 이동: 네트워크 우선, 실패하면 캐시된 index.html
 * - Firebase 요청은 건드리지 않는다 (Firestore가 자체 오프라인 캐시를 가짐)
 *
 * 새 버전을 배포할 때는 아래 VERSION을 바꾸면 이전 캐시가 정리된다.
 */
const VERSION = 'v0.3.0';
const CACHE = `fade-and-days-${VERSION}`;
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('fade-and-days-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 페이지 이동: 네트워크 우선
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // 설정 파일은 고치면 바로 반영되도록 네트워크 우선
  if (url.origin === self.location.origin && url.pathname.endsWith('/config.js')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // 같은 사이트의 파일과 웹폰트: 캐시 우선, 뒤에서 새로 받아 갱신
  if (url.origin === self.location.origin || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
