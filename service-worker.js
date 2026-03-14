const CACHE_NAME = "audio-player-cache-v1"

const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js"
]

self.addEventListener("install", event => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache)
      })
      .catch(err => {
        console.log("Cache failed:", err)
      })
  )

})

self.addEventListener("fetch", event => {

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request)
      })
  )

})
