const CARD_IMAGE_CACHE = "card-images-v2";
const LOCAL_CARD_PATH = "/cards/";
const LOCAL_CARD_RESIZED_PATHS = {
  256: "/cards-256/",
  512: "/cards-512/",
  1024: LOCAL_CARD_PATH,
};
const CARD_IMAGE_SIZES = [256, 512, 1024];

const inFlightRequests = new Map();
const failedUrls = new Set();
const localCardMisses = new Set();

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

const normalizeCardFileName = (name) => {
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  return /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.png`;
};

export const getLocalCardImageUrl = (name, basePath = LOCAL_CARD_PATH) => {
  const fileName = normalizeCardFileName(name);
  if (!fileName) return null;
  return `${basePath}${encodeURIComponent(fileName)}`;
};

const getLocalCardImageUrlFromFallback = (
  fallbackUrl,
  basePath = LOCAL_CARD_PATH
) => {
  if (!fallbackUrl) return null;
  try {
    const url = new URL(fallbackUrl);
    const parts = url.pathname.split("/");
    const fileName = parts[parts.length - 1];
    if (!fileName) return null;
    return getLocalCardImageUrl(decodeURIComponent(fileName), basePath);
  } catch (error) {
    return null;
  }
};

const getConnectionInfo = () => {
  if (typeof navigator === "undefined") return null;
  return (
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection ||
    null
  );
};

const getNetworkPreferredCardSize = () => {
  const connection = getConnectionInfo();
  if (!connection) return null;

  if (connection.saveData) {
    return 256;
  }

  const effectiveType = connection.effectiveType || "";
  if (
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g" ||
    effectiveType === "4g"
  ) {
    return 256;
  }

  return null;
};

const getOrderedCardSizes = (preferredSize) => {
  if (preferredSize && CARD_IMAGE_SIZES.includes(preferredSize)) {
    return [
      preferredSize,
      ...CARD_IMAGE_SIZES.filter((size) => size !== preferredSize),
    ];
  }
  return CARD_IMAGE_SIZES;
};

const getPreferredCardBasePaths = ({ preferredSize } = {}) => {
  const sizePreference =
    preferredSize || getNetworkPreferredCardSize() || 1024;

  return getOrderedCardSizes(sizePreference).map(
    (size) => LOCAL_CARD_RESIZED_PATHS[size]
  );
};

const getLocalCardImageCandidates = (
  name,
  fallbackUrl,
  { preferredSize } = {}
) => {
  const basePaths = getPreferredCardBasePaths({ preferredSize });
  const candidates = new Set();

  basePaths.forEach((basePath) => {
    candidates.add(getLocalCardImageUrl(name, basePath));
    candidates.add(getLocalCardImageUrlFromFallback(fallbackUrl, basePath));
  });

  return Array.from(candidates).filter(Boolean);
};

export const preloadCardImage = async (
  name,
  fallbackUrl,
  { preferredSize } = {}
) => {
  const localCandidates = getLocalCardImageCandidates(name, fallbackUrl, {
    preferredSize,
  });

  for (const localUrl of Array.from(new Set(localCandidates))) {
    const cached = await preloadImageToCache(localUrl);
    if (cached) {
      return { success: true, source: "local", url: localUrl };
    }
    localCardMisses.add(localUrl);
  }

  if (fallbackUrl) {
    const cachedFallback = await preloadImageToCache(fallbackUrl);
    return {
      success: cachedFallback,
      source: cachedFallback ? "fallback" : "none",
      url: fallbackUrl,
    };
  }

  return { success: false, source: "none", url: localCandidates[0] || null };
};

export const getCardImageUrl = async ({ name, fallbackUrl, preferredSize }) => {
  const localCandidates = getLocalCardImageCandidates(name, fallbackUrl, {
    preferredSize,
  });

  const canUseCache = "caches" in window;

  for (const localUrl of Array.from(new Set(localCandidates))) {
    if (!localUrl || localCardMisses.has(localUrl)) continue;
    const requestMode = getRequestMode(localUrl);
    try {
      const cache = canUseCache ? await caches.open(CARD_IMAGE_CACHE) : null;
      let response = cache ? await cache.match(localUrl) : null;
      if (!response) {
        response = await fetch(localUrl, {
          cache: "force-cache",
          mode: requestMode || "cors",
        });
        if (response.ok) {
          if (cache) {
            await cache.put(localUrl, response.clone());
          }
          return localUrl;
        }
        localCardMisses.add(localUrl);
      } else {
        return localUrl;
      }
    } catch (error) {
      localCardMisses.add(localUrl);
      console.warn("[imageCache] local card fetch failed", error);
    }
  }

  if (fallbackUrl) {
    await getCachedImageUrl(fallbackUrl);
    return fallbackUrl;
  }

  return localCandidates[0] || null;
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
