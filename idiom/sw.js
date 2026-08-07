/**
 * 成語大冒險 - Service Worker
 * 提供離線遊玩與資源快取
 */

const CACHE_NAME = "idiom-adventure-cache-v81-1786083924";
const ASSETS_TO_CACHE = [
  "index.html",
  "styles.css",
  "app.js",
  "idioms.json",
  "js/state.js",
  "js/cloud-save.js",
  "js/firebase-config.js",
  "js/audio.js",
  "js/confetti.js",
  "js/ui.js",
  "js/mascot.js",
  "js/social-rewards.js",
  "js/checkin.js",
  "js/minigames.js",
  "js/minigames/helpers.js",
  "js/minigames/shape_sound.js",
  "js/minigames/meaning_assoc.js",
  "js/minigames/reaction_memory.js",
  "manifest.json",
  "assets/app_icon.png",
  "assets/icons/boss_level_icon.jpg",
  "assets/maps/zone-forest-map.webp",
  "assets/idioms/frog_well.webp",
  "assets/idioms/lost_sheep.webp",
  "assets/idioms/snake_feet.webp",
  "assets/idioms/rabbit_tree.webp"
];

// 安裝時快取靜態資源
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] 快取所有靜態資源");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 啟動時清除舊快取
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] 刪除舊快取:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截網路請求：有網路時優先拿新版，離線時才回快取。
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") {
    e.respondWith(fetch(e.request));
    return;
  }

  const requestUrl = new URL(e.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (isSameOrigin && response && response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
