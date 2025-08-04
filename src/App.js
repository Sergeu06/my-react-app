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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./components/firebase"; // твой инициализированный Firestore
import { DndProvider } from "react-dnd";
import { TouchBackend } from "react-dnd-touch-backend";
import { useSwipeable } from "react-swipeable";

import { AnimatePresence, motion } from "framer-motion";

import "./App.css";

import CurrencyBalance from "./components/CurrencyBalance";
import Shop from "./components/ShopPage";
import OpenBoxPage from "./components/OpenBoxPage";
import Collection from "./components/CollectionPage";
import Profile from "./components/ProfilePage";
import FightPage from "./components/FightPage";
import Game from "./components/GamePage";
import UpgradePage from "./components/UpgradePage";
import Raid from "./components/raid-boss/RaidPage";
import { UserProvider } from "./components/UserContext";

const BOT_TOKEN = "6990185927:AAG8cCLlwX-z8ZcwYGN_oUOfGC2vONls87Q";

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
  initial: (direction) => ({ opacity: 0, x: direction > 0 ? 50 : -50 }),
  in: { opacity: 1, x: 0 },
  out: (direction) => ({ opacity: 0, x: direction > 0 ? -50 : 50 }),
};

const pageTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.4,
};

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

function App() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const startParam = searchParams.get("start");
  const [uid, setUid] = useState(startParam || "dev-user");
  const [direction, setDirection] = useState(0);

  const [, setTelegramUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState(null);

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

  const tabRoutes = [
    `/shop?start=${uid}`,
    `/collection?start=${uid}`,
    `/fight?start=${uid}`,
    `/upgrade?start=${uid}`,
    `/profile?start=${uid}`,
  ];
  const AnimatedPageWrapper = ({ children, direction }) => (
    <motion.div
      custom={direction}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{ height: "100%" }}
    >
      {children}
    </motion.div>
  );

  const updateTab = (newIndex) => {
    const prevIndex = prevTabIndexRef.current;
    const newDirection = newIndex > prevIndex ? 1 : -1;
    setDirection(newDirection);
    setTabIndex(newIndex);
    prevTabIndexRef.current = newIndex;
    navigate(tabRoutes[newIndex]);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (!path.includes("/raid") && tabIndex < tabRoutes.length - 1) {
        updateTab(tabIndex + 1);
      }
    },
    onSwipedRight: () => {
      if (!path.includes("/raid") && tabIndex > 0) {
        updateTab(tabIndex - 1);
      }
    },
    trackTouch: true,
    preventScrollOnSwipe: true,
  });

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

  if (!window.Telegram || !window.Telegram.WebApp) {
    console.error("❌ Telegram WebApp API не загружен");
    setError("Ошибка: Telegram WebApp API недоступен.");
    return;
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        <h2>Доступ запрещён</h2>
        <p>{error}</p>
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

  const path = location.pathname.toLowerCase();
  const isGameOrProfile = path === "/game";
  const isRaid = path === "/raid";

  return (
    <UserProvider>
      <div>
        <div className="safe-container" {...handlers}>
          <div className="background-container" />
          <div className="background-overlay" />
          <div className="game-version">v0.7.69.23</div>

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
                  label="Арена"
                  icon={<SportsEsportsIcon />}
                  component={Link}
                  to={`/fight?start=${uid}`}
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
                  label="Досье"
                  icon={<AccountCircleIcon />}
                  component={Link}
                  to={`/profile?start=${uid}`}
                  value={4}
                />
              </BottomNavigation>
            </div>
          )}

          <DndProvider backend={TouchBackend}>
            <AnimatePresence mode="wait" initial={false}>
              <Routes location={location} key={location.pathname}>
                <Route
                  path="/"
                  element={<Navigate to={`/fight?start=${uid}`} replace />}
                />
                <Route
                  path="/shop"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <Shop uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/collection"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <Collection uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <Profile uid={uid} />
                    </AnimatedPageWrapper>
                  }
                />
                <Route
                  path="/fight"
                  element={
                    <AnimatedPageWrapper direction={direction}>
                      <FightPage uid={uid} />
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
                    <AnimatedPageWrapper direction={direction}>
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
              </Routes>
            </AnimatePresence>
          </DndProvider>
        </div>
      </div>
    </UserProvider>
  );
}
export default App;
