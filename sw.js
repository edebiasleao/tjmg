/* TJMG Fiscal — Service Worker v72
   PWA-1/2: html2pdf.js e qrcode-generator agora cacheados pelo SW para uso offline.
   v72: SEG-1/2 hashing, COD-1/2/3/4/5/6, PWA-1/2/3, ARQ-1/2/3 aplicados.
   v71: Fase 4 da modularização — utils.js, router.js, auth.js ativados.
*/

const V = 'tjmg-v72';

/* PWA-1/2: libs CDN que precisam funcionar offline — cacheadas explicitamente. */
const CDN_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
];
const CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  /* ── Fase 1: módulos extraídos ── */
  './config.js',
  './data.js',
  './state.js',
  /* ── Fase 2: Sync, PhotoStore, DB ── */
  './photo-store.js',
  './sync.js',
  './db.js',
  /* ── Fase 3: geração de relatórios HTML ── */
  './report-html.js',
  './report-pdf.js',
  /* ── Fase 4: utils, router, auth ── */
  './utils.js',
  './router.js',
  './auth.js',
];

const BYPASS = [
  'supabase.co',
  'googleapis.com',
  'gstatic.com',
  'firebase',
  /* PWA-1/2: cdnjs e jsdelivr removidos do BYPASS para permitir cache das libs offline.
     As libs específicas são pré-cacheadas via CDN_CACHE no install. */
  'script.google.com',
  'dns.google'
];

/* ── Install ── */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(V).then(function(c) {
      /* App shell (same-origin) */
      return c.addAll(CACHE).then(function() {
        /* PWA-1/2: pré-cachear libs CDN para uso offline */
        return Promise.all(CDN_CACHE.map(function(url) {
          return fetch(url, {mode:'cors'}).then(function(r) {
            if(r && r.ok) c.put(url, r);
          }).catch(function(err) {
            console.warn('[SW] CDN cache falhou para', url, err);
          });
        }));
      });
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

  /* PWA-1/2: interceptar libs CDN antes do check de origem */
  var isCdnLib = CDN_CACHE.indexOf(e.request.url) !== -1;
  if (isCdnLib) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request, {mode:'cors'}).then(function(r) {
          if (r && r.ok) {
            var copy = r.clone();
            caches.open(V).then(function(c) { c.put(e.request, copy); });
          }
          return r;
        });
      })
    );
    return;
  }

  /* Ignora domínios externos (exceto CDN libs acima) */
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
