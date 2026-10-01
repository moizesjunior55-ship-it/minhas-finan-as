/* Minhas Finanças — Service Worker (atualizado para Minhas_Financas_v5_pwa_mobile5.html)
   - Páginas (navegação): rede primeiro, com fallback para o cache -> o app atualiza sozinho quando há internet
     e continua abrindo offline.
   - Demais arquivos do APP_SHELL (manifest, ícones): cache primeiro.
   - Somente GET e somente mesma origem. Nenhuma outra requisição é interceptada.
   - Não toca em localStorage nem nos dados financeiros. */
const CACHE_VERSION = 'v5-mobile5-4';
const CACHE_PREFIX = 'minhas-financas-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

const APP_HTML = './Minhas_Financas_v5_pwa_mobile5.html';
const APP_SHELL = [
  APP_HTML,
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // O HTML é obrigatório; se falhar, a instalação falha e o SW antigo continua valendo.
      await cache.add(new Request(APP_HTML, { cache: 'reload' }));
      // Os demais são tolerantes: um ícone ausente não impede o app de funcionar offline.
      await Promise.all(
        APP_SHELL.slice(1).map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegação (abrir o app): rede primeiro, cache como reserva.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(APP_HTML, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then((cached) => cached || caches.match(APP_HTML))
          .then((cached) => cached || Response.error())
      )
    );
    return;
  }

  // Demais recursos: cache primeiro; se não houver, rede.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).catch(() => Response.error());
    })
  );
});
