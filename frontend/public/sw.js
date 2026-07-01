// ===============================
// 🚀 AgentX Ultra SW
// Vite + Background Sync + Push
// ===============================

const CACHE_NAME = "agentx-v4"; // ✅ Bumped version to bust old stale caches
const API_CACHE = "agentx-api-cache";

// Basic shell
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/public/manifest.json",
];

// ===============================
// Install
// ===============================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// ===============================
// Activate – Clean Old Cache
// ===============================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ===============================
// Helper: Detect HTML
// ===============================
const isHTML = (req) =>
  req.destination === "document" ||
  req.headers.get("accept")?.includes("text/html");

// ===============================
// ✅ Fix: Detect Vite JS/CSS bundles
// These must NEVER be served from cache first —
// stale bundles were causing the white page on normal refresh.
// ===============================
const isViteAsset = (url) => {
  const u = new URL(url);
  return (
    u.pathname.startsWith("/assets/") ||
    u.pathname.endsWith(".js") ||
    u.pathname.endsWith(".jsx") ||
    u.pathname.endsWith(".css") ||
    u.searchParams.has("v") // Vite cache-busting query param
  );
};

// ===============================
// 🚫 Ignore Spline / 3D Files
// ===============================
const isHeavy3D = (url) =>
  url.includes("spline") ||
  url.endsWith(".glb") ||
  url.endsWith(".gltf");

// ===============================
// 1) API Request Strategy
// Cache → Update in Background
// ===============================
async function handleAPIRequest(req) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(req);

  const networkFetch = fetch(req)
    .then((res) => {
      const resClone = res.clone();
      cache.put(req, resClone).catch(() => {});
      return res;
    })
    .catch(() => cached);

  return cached || networkFetch;
}

// ===============================
// Failed POST Queue for Background Sync
// ===============================
const failedQueue = [];

async function processFailedQueue() {
  while (failedQueue.length > 0) {
    const entry = failedQueue.shift();
    try {
      await fetch(entry.url, entry.options);
      console.log("[BG SYNC] Sent:", entry.url);
    } catch (err) {
      console.log("[BG SYNC] Failed again, requeueing...");
      failedQueue.push(entry);
    }
  }
}

// ===============================
// Fetch Handler
// ===============================
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Skip 3D / heavy assets
  if (isHeavy3D(req.url)) {
    event.respondWith(fetch(req));
    return;
  }

  // Handle POST API requests for offline
  if (req.method === "POST" && req.url.includes("/api")) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cloned = req.clone();
          let bodyText = null;
          try {
            bodyText = await cloned.text();
          } catch {}

          failedQueue.push({
            url: req.url,
            options: {
              method: "POST",
              headers: cloned.headers,
              body: bodyText,
            },
          });

          self.registration.sync.register("retry-api-queue");

          return new Response(
            JSON.stringify({ message: "Saved offline & will retry" }),
            { status: 202 }
          );
        }
      })()
    );
    return;
  }

  // API requests → Cache first then network
  if (req.url.includes("/api")) {
    event.respondWith(handleAPIRequest(req));
    return;
  }

  // HTML → Network first, fall back to cache
  if (isHTML(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // ✅ Fix: Vite JS/CSS bundles → Network first, THEN cache
  // Previously these were cache-first, which served stale bundles
  // and caused the white page on normal refresh.
  if (isViteAsset(req.url)) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(req, resClone).catch(() => {})
          );
          return networkRes;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Other static assets → Cache first
  event.respondWith(
    caches.match(req).then((cacheRes) => {
      if (cacheRes) return cacheRes;

      return fetch(req).then((networkRes) => {
        if (req.url.startsWith(self.location.origin)) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(req, resClone).catch(() => {})
          );
        }
        return networkRes;
      });
    })
  );
});

// ===============================
// 2) Background Sync
// ===============================
self.addEventListener("sync", async (event) => {
  if (event.tag === "retry-api-queue") {
    console.log("[BG SYNC] Retrying queued requests...");
    event.waitUntil(processFailedQueue());
  }
});

// ===============================
// 3) Push Notifications
// ===============================
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {
    title: "AgentX Notification",
    body: "You have a new alert!",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/assets/logo.png",
      badge: "/assets/logo.png",
    })
  );
});

// Handle click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("https://vulnsneak-ai.vercel.app/ai")
  );
});