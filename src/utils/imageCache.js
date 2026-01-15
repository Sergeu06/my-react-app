const CARD_IMAGE_CACHE = "card-images-v1";

const inFlightRequests = new Map();
const failedUrls = new Set();

const getRequestMode = (src) => {
  try {
    const url = new URL(src, window.location.href);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    if (!isHttp) return null;
    return url.origin === window.location.origin ? "cors" : "no-cors";
  } catch (error) {
    return null;
  }
};

export const preloadImageToCache = async (src) => {
  if (!src) return false;
  if (failedUrls.has(src)) return false;
  const requestMode = getRequestMode(src);
  if (!requestMode || !("caches" in window)) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  try {
    if (inFlightRequests.has(src)) {
      return await inFlightRequests.get(src);
    }

    const cache = await caches.open(CARD_IMAGE_CACHE);
    const cachedResponse = await cache.match(src);
    if (!cachedResponse) {
      const requestPromise = fetch(src, {
        cache: "force-cache",
        mode: requestMode,
      })
        .then((response) => {
          if (response.ok || response.type === "opaque") {
            return cache.put(src, response.clone());
          }
          return null;
        })
        .catch((error) => {
          failedUrls.add(src);
          console.warn("[imageCache] preload failed", error);
        })
        .finally(() => {
          inFlightRequests.delete(src);
        });

      inFlightRequests.set(src, requestPromise);
      await requestPromise;
    }
    return true;
  } catch (error) {
    failedUrls.add(src);
    console.warn("[imageCache] preload failed", error);
    return false;
  }
};

export const getCachedImageUrl = async (src) => {
  if (!src) return null;
  if (failedUrls.has(src)) return src;
  const requestMode = getRequestMode(src);
  if (!requestMode || !("caches" in window)) return src;

  try {
    const cache = await caches.open(CARD_IMAGE_CACHE);
    let response = await cache.match(src);
    if (!response) {
      const fetchPromise = fetch(src, {
        cache: "force-cache",
        mode: requestMode,
      });
      response = await fetchPromise;
      if (response.ok || response.type === "opaque") {
        await cache.put(src, response.clone());
      }
    }
    if (!response) return src;
    return src;
  } catch (error) {
    failedUrls.add(src);
    console.warn("[imageCache] fetch failed", error);
    return src;
  }
};
