import React, { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import {
  Routes,
  Route,
  Link,
  useLocation,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { BottomNavigation, BottomNavigationAction } from "@mui/material";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CollectionsIcon from "@mui/icons-material/Collections";
import StoreIcon from "@mui/icons-material/Store";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import UpgradeIcon from "@mui/icons-material/ArrowCircleUpRounded";
import CryptoJS from "crypto-js";
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  doc,
  getDoc,
  setDoc,
  database,
  databaseRef,
  onValue,
} from "./components/firebase";
import { DndProvider } from "react-dnd";
import { TouchBackend } from "react-dnd-touch-backend";
import { useSwipeable } from "react-swipeable";
import NavTimer from "./utils/NavTimer"; // путь к вашему файлу

import { AnimatePresence, motion } from "framer-motion";

import "./App.css";

import CurrencyBalance from "./components/CurrencyBalance";
import Shop from "./components/ShopPage";
import OpenBoxPage from "./components/OpenBoxPage";
import Collection from "./components/CollectionPage";
import Profile from "./components/ProfilePage";
import FightPage from "./components/FightPage";
import Game from "./components/game/GamePage";
import UpgradePage from "./components/UpgradePage";
import Raid from "./components/raid-boss/RaidPage";
import ResultPage from "./components/ResultPage";
import GlobalLoader from "./components/GlobalLoader";

import { UserProvider } from "./components/UserContext";
import { preloadCardImage, preloadImageToCache } from "./utils/imageCache";
import { buildLootboxChances } from "./utils/lootboxChances";
import { initSingleSession } from "./session/singleSession";
import { detectLowEndDevice } from "./perf/detectLowEndDevice";
import { setLowEndMode } from "./perf/perfFlags";
import { PerformanceProvider } from "./perf/PerformanceContext";
import { debugLog } from "./perf/debugLog";

const BOT_TOKEN = "6990185927:AAG8cCLlwX-z8ZcwYGN_oUOfGC2vONls87Q";

const isMobile =
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent) ||
  navigator.maxTouchPoints > 1 ||
  window.innerWidth < 900;

function checkTelegramAuth(initData, botToken) {
  const params = {};
  initData.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    params[key] = decodeURIComponent(value);
  });

  const hash = params.hash;
  delete params.hash;

  const dataCheckString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("\n");

  const secretKey = CryptoJS.HmacSHA256(botToken, "WebAppData");

  const computedHash = CryptoJS.HmacSHA256(dataCheckString, secretKey).toString(
    CryptoJS.enc.Hex
  );

  return computedHash === hash;
}

async function createOrUpdateUserProfile(user) {
  const uid = String(user.id);
  const userRef = doc(db, "users", uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    const profile = {
      uid: uid,
      nickname: user.username || "Без имени",
      avatar_url: user.photo_url || "",
      balance: 3500,
      cards: [],
      stats: { wins: 0, losses: 0 },
    };
    await setDoc(userRef, profile);
  }
}

const pageVariants = {
  initial: (direction) => {
    const dir = direction || 1;
    return {
      x: dir > 0 ? "100%" : "-100%",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      // убрано: position: "absolute"
    };
  },
  in: {
    x: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transition: {
      type: "tween",
      ease: "easeInOut",
      duration: 0.4,
    },
    // убрано: position: "absolute"
  },
  out: (direction) => {
    const dir = direction || 1;
    return {
      x: dir > 0 ? "-100%" : "100%",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      transition: {
        type: "tween",
        ease: "easeInOut",
        duration: 0.4,
      },
      // убрано: position: "absolute"
    };
  },
};

// (необязательно) общий переход по умолчанию — фолбэк
const pageTransition = {
  default: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
};

function getPageBg(pathname) {
  if (pathname.includes("/fight")) return "rgba(11, 15, 22, 0.45)";
  if (pathname.includes("/shop")) return "rgba(43, 27, 18, 0.45)";
  if (pathname.includes("/collection")) return "rgba(16, 38, 53, 0.45)";
  if (pathname.includes("/upgrade")) return "rgba(26, 27, 51, 0.45)";
  if (pathname.includes("/profile")) return "rgba(18, 49, 38, 0.45)";
  if (pathname.includes("/raid")) return "rgba(55, 18, 14, 0.45)";
  if (pathname.includes("/open-box")) return "rgba(10, 33, 41, 0.45)";
  if (pathname.includes("/result")) return "rgba(28, 16, 38, 0.45)";
  return null;
}

function collectDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timestamp: Date.now(),
    connectionType: navigator.connection?.effectiveType || "unknown",
    downlink: navigator.connection?.downlink || null,
    rtt: navigator.connection?.rtt || null,
    saveData: navigator.connection?.saveData || false,
    performanceTiming: window.performance?.timing || null,
    memory: window.performance?.memory || null,
    telegramWebAppVersion: window.Telegram?.WebApp?.version || null,
    initDataUnsafe: window.Telegram?.WebApp?.initDataUnsafe || null,
  };
}

const getPreloadConcurrency = () => {
  const connection = navigator.connection;
  if (!connection) return 6;
  if (connection.saveData) return 3;
  switch (connection.effectiveType) {
    case "slow-2g":
      return 2;
    case "2g":
      return 3;
    case "3g":
      return 4;
    default:
      return 6;
  }
};

const runWithConcurrency = async (items, limit, task) => {
  if (!items.length) return;
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(limit, queue.length) },
    async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item === undefined) return;
        await task(item);
      }
    }
  );
  await Promise.all(workers);
};

function App() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const startParam = searchParams.get("start");
  const [uid, setUid] = useState(startParam || "dev-user");
  const [direction, setDirection] = useState(0);
  const backgroundRef = useRef(null);
  const [uiLocked, setUiLocked] = useState(false);
  const [, setTelegramUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [error, setError] = useState(null);
  const [lowEndMode] = useState(() => detectLowEndDevice());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetsProgress, setAssetsProgress] = useState({
    loaded: 0,
    total: 0,
  });
  const [searchState, setSearchState] = useState({
    isSearching: false,
    searchStartPath: null,
    secondsElapsed: 0,
    lobbyId: null,
  });
  const [tabIndex, setTabIndex] = useState(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/shop")) return 0;
    if (path.includes("/collection")) return 1;
    if (path.includes("/fight")) return 2;
    if (path.includes("/upgrade")) return 3;
    if (path.includes("/profile")) return 4;
    return -1;
  });
  const prevTabIndexRef = useRef(tabIndex);

  const navigate = useNavigate();

  useEffect(() => {
    setLowEndMode(lowEndMode);
  }, [lowEndMode]);

  useEffect(() => {
    setIsTransitioning(true);
    if (lowEndMode) {
      const rafId = requestAnimationFrame(() => {
        setIsTransitioning(false);
      });
      return () => cancelAnimationFrame(rafId);
    }
    return undefined;
  }, [location.pathname, lowEndMode]);

  useEffect(() => {
    if (!isVerified) return;
    let isActive = true;
    const staticAssets = [
      "/666666.png",
      "/CARDB.jpg",
      "/favicon.ico",
      "/logo192.png",
      "/logo512.png",
      "/moneta.png",
      "/pngegg.png",
      "/sperm-1.png",
      "/sperm-2.png",
      "/ticket.png",
      "/озеро2.png",
      "/озеро3.png",
      "/Secret Recipes.png",
      "/frames/common.png",
      "/frames/epic.png",
      "/frames/legend.png",
      "/frames/lootbox.png",
      "/frames/rare.png",
      "/images/lid.png",
      "/images/plate.png",
      "/images/QR.png",
      "/images/raidboss.png",
    ];

    const CARD_BATCH_SIZE = 20;

    const incrementAssetsProgress = (loadedDelta = 0, totalDelta = 0) => {
      if (!isActive) return;
      setAssetsProgress((prev) => {
        const total = prev.total + totalDelta;
        const loaded = Math.min(prev.loaded + loadedDelta, total);
        return { loaded, total };
      });
    };

    const fetchRemoteImages = async () => {
      const urls = new Set();
      const boxEntries = [];
      try {
        const boxesSnapshot = await getDocs(collection(db, "box"));

        boxesSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.image_url) urls.add(data.image_url);
          boxEntries.push({ id: docSnap.id, data });
        });
      } catch (err) {
        console.warn("[GlobalLoader] remote image fetch failed", err);
      }

      return { urls: Array.from(urls), boxEntries };
    };

    const fetchCardBatch = async (lastDoc) => {
      const constraints = [orderBy("__name__"), limit(CARD_BATCH_SIZE)];
      if (lastDoc) constraints.push(startAfter(lastDoc));
      const cardsSnapshot = await getDocs(
        query(collection(db, "cards"), ...constraints)
      );

      const cardEntries = [];
      const fallbackUrls = [];

      cardsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.name) {
          cardEntries.push({
            name: data.name,
            image_url: data.image_url || "",
          });
        } else if (data?.image_url) {
          fallbackUrls.push(data.image_url);
        }
      });

      return {
        cardEntries,
        fallbackUrls,
        lastDoc: cardsSnapshot.docs[cardsSnapshot.docs.length - 1] || null,
        isLastBatch: cardsSnapshot.size < CARD_BATCH_SIZE,
      };
    };

    const waitForIdle = () =>
      new Promise((resolve) => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
          window.requestIdleCallback(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });

    const preloadCardBatches = async () => {
      if (lowEndMode) return;
      let lastDoc = null;
      let reachedEnd = false;
      const preloadConcurrency = getPreloadConcurrency();

      while (!reachedEnd) {
        const { cardEntries, fallbackUrls, lastDoc: nextDoc, isLastBatch } =
          await fetchCardBatch(lastDoc);
        const batchTotal = cardEntries.length + fallbackUrls.length;
        if (batchTotal === 0) break;

        incrementAssetsProgress(0, batchTotal);

        const tasks = [
          ...cardEntries.map((card) => ({
            type: "card",
            payload: card,
          })),
          ...fallbackUrls.map((url) => ({
            type: "fallback",
            payload: url,
          })),
        ];

        await runWithConcurrency(tasks, preloadConcurrency, async (task) => {
          if (task.type === "card") {
            const result = await preloadCardImage(
              task.payload.name,
              task.payload.image_url
            );
            debugLog("[GlobalLoader] card image cached", {
              name: task.payload.name,
              fallbackUrl: task.payload.image_url,
              ...result,
            });
          } else {
            const result = await preloadCardImage(null, task.payload);
            debugLog("[GlobalLoader] asset cached", {
              src: task.payload,
              cached: result.success,
              source: result.source,
              url: result.url,
            });
          }
          incrementAssetsProgress(1, 0);
        });

        lastDoc = nextDoc;
        reachedEnd = isLastBatch;
        await waitForIdle();
      }
    };

    const preloadAssets = async () => {
      const { urls: remoteAssets, boxEntries } = lowEndMode
        ? { urls: [], boxEntries: [] }
        : await fetchRemoteImages();
      const allAssets = lowEndMode ? staticAssets : [...staticAssets, ...remoteAssets];
      const lootboxCache = {};
      const preloadConcurrency = lowEndMode ? 2 : getPreloadConcurrency();
      const boxConcurrency = Math.max(2, Math.floor(preloadConcurrency / 2));

      if (isActive) {
        setAssetsProgress({
          loaded: 0,
          total: allAssets.length + boxEntries.length,
        });
      }

      await Promise.all([
        runWithConcurrency(allAssets, preloadConcurrency, async (src) => {
          const cached = await preloadImageToCache(src);
          debugLog("[GlobalLoader] asset cached", { src, cached });
          incrementAssetsProgress(1, 0);
        }),
        runWithConcurrency(boxEntries, boxConcurrency, async (box) => {
          if (lowEndMode) return;
          const cardIds = box.data?.cards || [];
          const rarityChances = {
            Обычная: box.data?.Обычная ?? 0,
            Редкая: box.data?.Редкая ?? 0,
            Эпическая: box.data?.Эпическая ?? 0,
            Легендарная: box.data?.Легендарная ?? 0,
          };

          const cardSnaps = await Promise.all(
            cardIds.map((cardId) => getDoc(doc(db, "cards", cardId)))
          );

          const boxCards = cardSnaps
            .map((snap, index) => {
              if (!snap.exists()) return null;
              const cardData = snap.data();
              return {
                card_id: cardIds[index],
                name: cardData.name || "Без имени",
                rarity: (cardData.rarity || "обычная").toLowerCase(),
              };
            })
            .filter(Boolean);

          const rarityCountMap = {};
          boxCards.forEach((card) => {
            rarityCountMap[card.rarity] =
              (rarityCountMap[card.rarity] || 0) + 1;
          });

          lootboxCache[box.id] = buildLootboxChances(
            boxCards,
            rarityChances,
            rarityCountMap
          );

          incrementAssetsProgress(1, 0);
        }),
      ]);

      if (!lowEndMode) {
        await waitForIdle();
        await preloadCardBatches();
      }

      if (lowEndMode) return;
      try {
        const cachedRaw = localStorage.getItem("lootboxChanceCache");
        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        localStorage.setItem(
          "lootboxChanceCache",
          JSON.stringify({ ...cached, ...lootboxCache })
        );
      } catch (err) {
        console.warn("[GlobalLoader] lootbox cache save failed", err);
      }
    };

    preloadAssets()
      .catch((err) => console.warn("[GlobalLoader] preload failed", err))
      .finally(() => {
        if (!isActive) return;
        setAssetsReady(true);
      });

    return () => {
      isActive = false;
    };
  }, [isVerified, lowEndMode]);

  const tabRoutes = [
    `/shop?start=${uid}`,
    `/collection?start=${uid}`,
    `/fight?start=${uid}`,
    `/upgrade?start=${uid}`,
    `/profile?start=${uid}`,
  ];
  // базовый slide-анимации
  const pageVariantsDefault = {
    initial: (direction) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
      position: "absolute",
    }),
    in: {
      x: 0,
      opacity: 1,
      position: "absolute",
      transition: { duration: 0.4, ease: "easeInOut" },
    },
    out: (direction) => ({
      x: direction > 0 ? "-100%" : "100%",
      opacity: 0,
      position: "absolute",
      transition: { duration: 0.4, ease: "easeInOut" },
    }),
  };

  // спец fade-анимации для game ↔ result
  const pageVariantsGameResult = {
    initial: { opacity: 0 },
    in: {
      opacity: 1,
      transition: { duration: 0.6, ease: "easeInOut" },
    },
    out: {
      opacity: 0,
      transition: { duration: 0.4, ease: "easeInOut" },
    },
  };

  const AnimatedPageWrapper = ({ children, direction }) => {
    const location = useLocation();
    const isGameOrResult =
      location.pathname.startsWith("/game") ||
      location.pathname.startsWith("/result");
    const isFullBleedPage =
      location.pathname.startsWith("/raid") ||
      location.pathname.startsWith("/game") ||
      location.pathname.startsWith("/open-box");

    if (lowEndMode) {
      return (
        <div
          className={`page-shell${
            isFullBleedPage ? " page-shell--full-bleed" : ""
          }`}
        >
          {children}
        </div>
      );
    }

    return (
      <motion.div
        custom={direction}
        initial="initial"
        animate="in"
        exit="out"
        variants={isGameOrResult ? pageVariantsGameResult : pageVariantsDefault}
        className="animated-page"
        onAnimationComplete={(definition) => {
          if (definition === "in") {
            setIsTransitioning(false);
          }
        }}
        style={{
          position: "relative",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: "visible",
          background: isGameOrResult ? "black" : "transparent",
        }}
      >
        <div
          className={`page-shell${
            isFullBleedPage ? " page-shell--full-bleed" : ""
          }`}
        >
          {children}
        </div>
      </motion.div>
    );
  };

  const updateTab = (newIndex, dir = null) => {
    const newDirection = dir !== null ? dir : newIndex > tabIndex ? 1 : -1;

    setDirection(newDirection);
    setTabIndex(newIndex);
    navigate(tabRoutes[newIndex]);
  };

  // обновляем prevTabIndexRef только после смены tabIndex
  useEffect(() => {
    prevTabIndexRef.current = tabIndex;
  }, [tabIndex]);

  const handlers = useSwipeable({
    onSwipedLeft: (eventData) => {
      if (eventData.event.target.closest(".fusion-slider")) return;

      if (
        !path.includes("/raid") &&
        !path.includes("/game") &&
        tabIndex < tabRoutes.length - 1
      ) {
        updateTab(tabIndex + 1, 1); // 👉 вправо
      }
    },
    onSwipedRight: (eventData) => {
      if (eventData.event.target.closest(".fusion-slider")) return;

      if (!path.includes("/raid") && !path.includes("/game") && tabIndex > 0) {
        updateTab(tabIndex - 1, -1); // 👈 влево
      }
    },
    trackTouch: true,
    preventScrollOnSwipe: true,
  });

  // вспомогательная функция форматирования
  const formatNavTime = (startTimestamp) => {
    if (!startTimestamp) return "0:00";
    const diff = Math.floor((Date.now() - startTimestamp) / 1000);
    const m = Math.floor(diff / 60);
    const s = String(diff % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  useEffect(() => {
    if (!searchState.lobbyId || !uid) return;

    const lobbyRef = databaseRef(database, `lobbies/${searchState.lobbyId}`);
    const unsubscribe = onValue(lobbyRef, (snapshot) => {
      const lobby = snapshot.val();
      if (!lobby) return;

      const players = lobby.players || [];
      if (
        players.length === 2 &&
        lobby.status === "waiting" &&
        players.includes(uid)
      ) {
        const currentPath = location.pathname.toLowerCase();
        if (!currentPath.includes("/fight")) {
          setUiLocked(true);
          navigate(searchState.searchStartPath || `/fight?start=${uid}`);
          setTimeout(() => setUiLocked(false), 1200); // достаточно, чтобы не тыкали во время переезда
        }
      }
    });

    return () => unsubscribe();
  }, [
    searchState.lobbyId,
    uid,
    location.pathname,
    navigate,
    searchState.searchStartPath,
  ]);
  useEffect(() => {
    const reset = searchParams.get("resetSearch");
    if (reset === "1") {
      setSearchState({
        isSearching: false,
        searchStartPath: null,
        secondsElapsed: 0,
        lobbyId: null,
        startTimestamp: null,
      });

      // чтобы не зацикливалось при любом ререндере
      const url = new URL(window.location.href);
      url.searchParams.delete("resetSearch");
      window.history.replaceState(null, "", url.toString());
    }
  }, [searchParams, setSearchState]);

  useEffect(() => {
    const bg = backgroundRef.current;
    if (!bg) return;

    const path = location.pathname.toLowerCase();
    const shouldParallax =
      path.includes("/shop") ||
      path.includes("/collection") ||
      path.includes("/profile");

    if (!shouldParallax) {
      bg.style.backgroundPositionY = "0px";
      return;
    }

    let rafId = null;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const maxShift = window.innerHeight;
      const desiredShift = scrollY * -0.4;
      const clampedShift = Math.max(-maxShift, Math.min(0, desiredShift));
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        bg.style.backgroundPositionY = `${clampedShift}px`;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [location.pathname]);

  useEffect(() => {
    const isDev = window.location.hostname === "localhost";

    if (isDev) {
      const fallbackUid = "880861299"; // ← ваш Telegram user.id
      const finalUid = startParam || fallbackUid;

      setTelegramUser({ id: finalUid, first_name: "Dev" });
      setUid(finalUid);
      setIsVerified(true);

      // также обновим ссылку в адресной строке, если параметра start нет
      const url = new URL(window.location.href);
      if (!url.searchParams.get("start")) {
        url.searchParams.set("start", finalUid);
        window.history.replaceState(null, "", url.toString());
      }

      return;
    }

    const webApp = window.Telegram?.WebApp;

    try {
      if (webApp?.expand) webApp.expand();
      if (webApp?.requestFullscreen) webApp.requestFullscreen();
      webApp.disableVerticalSwipes();
      if (webApp?.lockOrientation) webApp.lockOrientation("portrait");
    } catch (e) {
      console.warn("Fullscreen or orientation lock not supported", e);
    }

    async function verifyAndCreateProfile() {
      await webApp.ready();

      const initDataRaw = webApp.initData || "";
      const unsafeData = webApp.initDataUnsafe || null;

      if (!initDataRaw || initDataRaw.length < 10) {
        setError(
          "Ошибка: Telegram не передал данные авторизации. Откройте WebApp из Telegram."
        );
        return;
      }

      if (!checkTelegramAuth(initDataRaw, BOT_TOKEN)) {
        setError("Ошибка: недействительная подпись Telegram");
        return;
      }

      if (!unsafeData?.user) {
        setError("Ошибка: нет данных пользователя Telegram");
        return;
      }

      const user = unsafeData.user;
      setTelegramUser(user);
      setIsVerified(true);

      try {
        await createOrUpdateUserProfile(user);
      } catch (err) {
        console.error("Ошибка создания профиля Firebase:", err);
      }

      if (String(startParam) !== String(user.id)) {
        const url = new URL(window.location.href);
        url.searchParams.set("start", user.id);
        window.history.replaceState(null, "", url.toString());
        setUid(String(user.id));
      } else {
        setUid(String(startParam));
      }

      try {
        console.log("📦 Сбор данных устройства...");
        const deviceInfo = collectDeviceInfo();
        console.log("✅ Данные устройства собраны:", deviceInfo);

        if (webApp?.sendData) {
          const payload = JSON.stringify(deviceInfo);
          console.log("📤 Payload для sendData:", payload);

          try {
            webApp.sendData(payload);
            console.log("✅ Успешно отправлено через Telegram WebApp");
          } catch (err) {
            console.error("❌ Ошибка при отправке через sendData:", err);
          }
        } else {
          console.warn(
            "⚠️ Telegram WebApp.sendData не поддерживается в этом окружении"
          );
        }
      } catch (e) {
        console.error("❌ Ошибка при сборе/отправке deviceInfo:", e);
      }
    }

    verifyAndCreateProfile();
  }, [startParam]);

  useEffect(() => {
    const path = location.pathname.toLowerCase();

    if (path.includes("/shop")) setTabIndex(0);
    else if (path.includes("/collection")) setTabIndex(1);
    else if (path.includes("/fight")) setTabIndex(2);
    else if (path.includes("/upgrade")) setTabIndex(3);
    else if (path.includes("/profile")) setTabIndex(4);
  }, [location.pathname]);

  useEffect(() => {
    if (!window.Telegram || !window.Telegram.WebApp) {
      setError(
        "Ошибка: Telegram WebApp API недоступен. Откройте приложение через Telegram."
      );
    }
  }, []);

  useEffect(() => {
    if (!isVerified || !uid || isKicked) return;
    let isActive = true;
    let cleanup = null;

    const startSession = async () => {
      const disposer = await initSingleSession({
        rtdb: database,
        tgUserId: uid,
        onKicked: () => {
          setUiLocked(true);
          setIsKicked(true);
        },
      });

      if (!isActive) {
        disposer();
        return;
      }

      cleanup = disposer;
    };

    startSession();

    return () => {
      isActive = false;
      if (cleanup) cleanup();
    };
  }, [isVerified, uid, isKicked]);

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        <h2>Доступ запрещён</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (isKicked) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f16",
          color: "white",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h2 style={{ marginBottom: 12 }}>Сессия завершена</h2>
        <p style={{ maxWidth: 360, opacity: 0.8 }}>
          Вы вошли с другого устройства. Эта сессия завершена.
        </p>
      </div>
    );
  }
  if (!isMobile) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1c1c",
          color: "white",
          textAlign: "center",
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 28, marginBottom: 20 }}>
          ОТКРЫТЬ ПРИЛОЖЕНИЕ МОЖНО С ТЕЛЕФОНА
        </h1>

        <p style={{ fontSize: 18, marginBottom: 20 }}>
          Наведите камеру телефона на QR-код
        </p>

        <img
          src="/images/QR.png"
          alt="qr"
          style={{
            width: 220,
            height: 220,
            padding: 10,
            borderRadius: 12,
          }}
        />

        <p style={{ marginTop: 20, opacity: 0.6 }}>Доступ с ПК ограничен</p>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div style={{ padding: 20 }}>
        <p>Проверка авторизации Telegram...</p>
      </div>
    );
  }
  if (!assetsReady) {
    return (
      <GlobalLoader
        loaded={assetsProgress.loaded}
        total={assetsProgress.total}
      />
    );
  }

  const path = location.pathname.toLowerCase();
  const isGameOrProfile = path === "/game";
  const isRaid = path === "/raid";
  const pageBackground = getPageBg(path);
  const backgroundClass = (() => {
    if (path.includes("/fight")) return "bg-fight";
    if (path.includes("/shop")) return "bg-shop";
    if (path.includes("/collection")) return "bg-collection";
    if (path.includes("/upgrade")) return "bg-upgrade";
    if (path.includes("/profile")) return "bg-profile";
    if (path.includes("/raid")) return "bg-raid";
    if (path.includes("/game")) return "bg-game";
    if (path.includes("/open-box")) return "bg-open-box";
    if (path.includes("/result")) return "bg-result";
    return "bg-shop";
  })();

  return (
    <PerformanceProvider value={{ lowEndMode, isTransitioning }}>
      <UserProvider>
      <div>
        <div className="safe-container" {...handlers}>
          {uiLocked && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2000,
                background: "transparent",
              }}
            />
          )}
          <div
            className="page-bg-overlay"
            style={{
              backgroundColor: pageBackground || "transparent",
              opacity: pageBackground ? 1 : 0,
            }}
            aria-hidden="true"
          />
          <div
            className={`background-container ${backgroundClass}`}
            ref={backgroundRef}
          />
          <div className="game-version">v0.9.96.14</div>

          <CurrencyBalance />

          {!isGameOrProfile && !isRaid && (
            <div
              style={{
                position: "fixed",
                bottom: 0,
                width: "100%",
                zIndex: 1000,
                height: 55,
              }}
            >
              <BottomNavigation
                value={tabIndex}
                onChange={(event, newValue) => {
                  if (uiLocked) return;
                  if (newValue !== tabIndex) {
                    updateTab(newValue);
                  }
                }}
                showLabels
                className="custom-nav"
              >
                <BottomNavigationAction
                  label="Торговец"
                  icon={<StoreIcon />}
                  component={Link}
                  to={`/shop?start=${uid}`}
                  value={0}
                />
                <BottomNavigationAction
                  label="Архив"
                  icon={<CollectionsIcon />}
                  component={Link}
                  to={`/collection?start=${uid}`}
                  value={1}
                />
                <BottomNavigationAction
                  label={
                    searchState.isSearching ? (
                      <>
                        Арена (
                        <NavTimer startTimestamp={searchState.startTimestamp} />
                        )
                      </>
                    ) : (
                      "Арена"
                    )
                  }
                  icon={
                    <SportsEsportsIcon
                      color={searchState.isSearching ? "warning" : "inherit"}
                    />
                  }
                  component={Link}
                  to={
                    searchState.isSearching
                      ? searchState.searchStartPath
                      : `/fight?start=${uid}`
                  }
                  value={2}
                />

                <BottomNavigationAction
                  label="Эволюция"
                  icon={<UpgradeIcon />}
                  component={Link}
                  to={`/upgrade?start=${uid}`}
                  value={3}
                />
                <BottomNavigationAction
                  label="Профиль"
                  icon={<AccountCircleIcon />}
                  component={Link}
                  to={`/profile?start=${uid}`}
                  value={4}
                />
              </BottomNavigation>
            </div>
          )}

          <DndProvider
            backend={TouchBackend}
            options={{
              enableMouseEvents: true,
              delayTouchStart: 0,
              delayMouseStart: 0,
              touchSlop: 0,
            }}
          >
            {lowEndMode ? (
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/fight"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <FightPage
                        uid={uid}
                        searchState={searchState}
                        setSearchState={setSearchState}
                      />
                    </AnimatedPageWrapper>
                  }
                />

                <Route
                  path="/"
                  element={<Navigate to={`/fight?start=${uid}`} replace />}
                />

                <Route
                  path="/shop"
                  element={
                    <AnimatedPageWrapper
                      direction={direction}
                      allowScroll={true}
                    >
                      <Shop uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/collection"
                  element={
                    <AnimatedPageWrapper
                      direction={direction}
                      allowScroll={true}
                    >
                      <Collection uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <AnimatedPageWrapper
                      direction={direction}
                      allowScroll={true}
                    >
                      <Profile uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/upgrade"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <UpgradePage uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/game"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <Game uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/raid"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <Raid uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/profile/:userId"
                  element={
                    <AnimatedPageWrapper
                      direction={direction}
                      allowScroll={true}
                    >
                      <Profile />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/open-box"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <OpenBoxPage uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/result"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <ResultPage uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
              </Routes>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <Routes location={location} key={location.pathname}>
                  <Route
                    path="/fight"
                    element={
                      <AnimatedPageWrapper direction={direction}>
                        <FightPage
                          uid={uid}
                          searchState={searchState}
                          setSearchState={setSearchState}
                        />
                      </AnimatedPageWrapper>
                    }
                  />

                  <Route
                    path="/"
                    element={<Navigate to={`/fight?start=${uid}`} replace />}
                  />

                  <Route
                    path="/shop"
                    element={
                      <AnimatedPageWrapper
                        direction={direction}
                        allowScroll={true}
                      >
                        <Shop uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/collection"
                    element={
                      <AnimatedPageWrapper
                        direction={direction}
                        allowScroll={true}
                      >
                        <Collection uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <AnimatedPageWrapper
                        direction={direction}
                        allowScroll={true}
                      >
                        <Profile uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/upgrade"
                    element={
                      <AnimatedPageWrapper direction={direction}>
                        <UpgradePage uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/game"
                    element={
                      <AnimatedPageWrapper direction={direction}>
                        <Game uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/raid"
                    element={
                      <AnimatedPageWrapper direction={direction}>
                        <Raid uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/profile/:userId"
                    element={
                      <AnimatedPageWrapper
                        direction={direction}
                        allowScroll={true}
                      >
                        <Profile />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/open-box"
                    element={
                      <AnimatedPageWrapper direction={direction}>
                        <OpenBoxPage uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                  <Route
                    path="/result"
                    element={
                      <AnimatedPageWrapper direction={direction}>
                        <ResultPage uid={uid} />
                      </AnimatedPageWrapper>
                    }
                  />
                </Routes>
              </AnimatePresence>
            )}
          </DndProvider>
        </div>
      </div>
      </UserProvider>
    </PerformanceProvider>
  );
}
export default App;
