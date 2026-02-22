const CACHE_NAME = "financego-v2";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/transactions",
  "/transactions/new",
  "/schedule",
  "/reports",
  "/ai",
  "/settings",
  "/auth",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip non-http(s) requests (chrome-extension://, etc)
  if (!url.protocol.startsWith("http")) return;

  // API calls: network-first
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "Sem conexao" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Supabase calls: network only
  if (url.hostname.includes("supabase")) return;

  // Static assets & pages: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetched = fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });
        return cached || fetched;
      })
    )
  );
});
