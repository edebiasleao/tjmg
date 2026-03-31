/* TJMG Fiscal — Service Worker v66
   Estratégia:
   - App shell (index.html, sw.js, manifest.json, js/*.js) → network-first, fallback cache
   - Demais assets → cache-first, atualiza cache em background
   - Domínios externos (Supabase, CDN, Google) → nunca interceptados

   v66: Fase 1 da modularização — js/config.js, js/data.js, js/state.js adicionados ao CACHE.
        Bump de v65 → v66 força re-download dos módulos novos em todos os dispositivos.
*/

const V = 'tjmg-v66';
const CACHE = [
  './',
  './index.html',
  './manifest.json',
  /* ── Fase 1: módulos extraídos ── */
  './js/config.js',
  './js/data.js',
  './js/state.js'
  /* Fases seguintes: adicionar aqui conforme cada módulo for extraído
  './js/sync.js',
  './js/photo-store.js',
  './js/db.js',
  './js/utils.js',
  './js/router.js',
  './js/auth.js',
  */
];

const BYPASS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com',
  'firebase',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'script.google.com',
  'dns.google'
];

/* ── Install ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(V).then(function(c) {
      return c.addAll(CACHE);
    }).catch(function(err) {
      console.warn('[SW] install cache falhou:', err);
    })
  );
  self.skipWaiting();
});

/* ── Activate: limpa caches antigos ── */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== V; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

/* ── Mensagens (skipWaiting) ── */
self.addEventListener('message', function(e) {
  if (e.data === 'skipWaiting' || (e.data && e.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

/* ── Fetch ── */
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url;
  try { url = new URL(e.request.url); } catch(err) { return; }

  /* Ignora domínios externos */
  if (BYPASS.some(function(d) { return url.hostname.includes(d); })) return;

  /* Ignora outras origens */
  if (url.origin !== self.location.origin) return;

  var path = url.pathname;
  var isShell = (
    path.endsWith('/index.html') ||
    path.endsWith('/sw.js')      ||
    path.endsWith('/manifest.json') ||
    path === '/' ||
    path.endsWith('/')
  );

  if (isShell) {
    /* Network-first para o app shell */
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(function(r) {
          if (r && r.ok) {
            /* Clona ANTES de retornar — body ainda não foi lido */
            var copy = r.clone();
            caches.open(V).then(function(c) { c.put(e.request, copy); });
          }
          return r;
        })
        .catch(function() {
          return caches.match(e.request)
            .then(function(hit) { return hit || caches.match('./index.html'); });
        })
    );
    return;
  }

  /* Cache-first para outros assets
     Background update: faz fetch separado para não reutilizar body */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        /* Atualiza o cache em background com um fetch independente */
        caches.open(V).then(function(c) {
          fetch(e.request).then(function(fresh) {
            if (fresh && fresh.ok) c.put(e.request, fresh);
          }).catch(function() {});
        });
        return cached;
      }
      /* Não tem cache — busca na rede e armazena */
      return fetch(e.request).then(function(r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open(V).then(function(c) { c.put(e.request, copy); });
        }
        return r;
      });
    })
  );
});
