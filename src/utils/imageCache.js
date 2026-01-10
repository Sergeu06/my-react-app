const CARD_IMAGE_CACHE = "card-images-v1";

export const preloadImageToCache = async (src) => {
  if (!src) return false;
  if (!("caches" in window)) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  try {
    const cache = await caches.open(CARD_IMAGE_CACHE);
    const cachedResponse = await cache.match(src);
    if (!cachedResponse) {
      const response = await fetch(src, { cache: "force-cache" });
      if (response.ok) {
        await cache.put(src, response.clone());
      }
    }
    return true;
  } catch (error) {
    console.warn("[imageCache] preload failed", error);
    return false;
  }
};

export const getCachedImageUrl = async (src) => {
  if (!src) return null;
  if (!("caches" in window)) return src;

  try {
    const cache = await caches.open(CARD_IMAGE_CACHE);
    let response = await cache.match(src);
    if (!response) {
      response = await fetch(src, { cache: "force-cache" });
      if (response.ok) {
        await cache.put(src, response.clone());
      }
    }
    if (!response || !response.ok) return src;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn("[imageCache] fetch failed", error);
    return src;
  }
};
