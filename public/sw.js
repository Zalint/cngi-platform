// Bump à chaque release pour purger les anciens caches chez les utilisateurs.
const CACHE_NAME = 'cngi-v5-2026-05-05';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/main.css',
    '/js/utils/dateFormatter.js',
    '/js/utils/api.js',
    '/js/utils/auth.js',
    '/js/utils/geoConverter.js',
    '/js/components/toast.js',
    '/js/components/navbar.js',
    '/js/pages/login.js',
    '/js/pages/dashboard.js',
    '/js/pages/projects.js',
    '/js/pages/projectDetail.js',
    '/js/pages/projectForm.js',
    '/js/pages/forms.js',
    '/js/pages/formView.js',
    '/js/pages/formBuilder.js',
    '/js/pages/admin.js',
    '/js/pages/users.js',
    '/js/pages/projectStructures.js',
    '/js/app.js',
    '/manifest.json',
    // Vendored externes (auto-hébergés). togeojson/shpjs sont gros (~260 KB
    // shpjs) mais on les pré-cache pour que l'import KML/Shapefile fonctionne
    // hors-ligne dès la première visite.
    '/vendor/leaflet/leaflet.js',
    '/vendor/leaflet/leaflet.css',
    '/vendor/togeojson/togeojson.umd.js',
    '/vendor/shpjs/shp.min.js',
    '/fonts/fonts.css'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Filtre : ne traiter que http(s). Les schemes comme chrome-extension://
    // ou moz-extension:// ne peuvent pas être stockés dans le Cache API et
    // produisent des erreurs "Request scheme not supported" si on essaie.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // API calls: network only (don't cache)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response(
                    JSON.stringify({ success: false, message: 'Hors ligne' }),
                    { headers: { 'Content-Type': 'application/json' } }
                );
            })
        );
        return;
    }

    // Static assets: cache first, then network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request).then((response) => {
                // Cache uniquement les réponses GET 2xx same-origin.
                // - Les POST ne sont pas cachables.
                // - Les réponses cross-origin opaques (status=0) ni les chrome-extension
                //   ne peuvent pas être mises en cache → on évite le put pour
                //   ne pas spammer les logs avec des "scheme not supported".
                if (response.ok
                    && event.request.method === 'GET'
                    && response.type !== 'opaque'
                    && response.type !== 'opaqueredirect') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, clone))
                        .catch(() => {}); // silencieux : dernière protection
                }
                return response;
            }).catch(() => cached);

            return cached || networkFetch;
        })
    );
});
