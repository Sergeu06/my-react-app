import {
  ref,
  runTransaction,
  onValue,
  onDisconnect,
  set,
  remove,
} from "firebase/database";

const DEVICE_ID_KEY = "tg_device_id";

const generateUuid = () => {
  const cryptoProvider = window.crypto;
  if (cryptoProvider?.randomUUID) {
    return cryptoProvider.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (cryptoProvider?.getRandomValues) {
    cryptoProvider.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
};

const getOrCreateDeviceId = () => {
  try {
    const stored = window.localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const created = generateUuid();
    window.localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch (error) {
    console.warn("Failed to access localStorage for deviceId", error);
    return generateUuid();
  }
};

export const initSingleSession = async ({ rtdb, tgUserId, onKicked }) => {
  if (!rtdb || !tgUserId) {
    return () => {};
  }

  const uid = String(tgUserId);
  const sessionId = generateUuid();
  const deviceId = getOrCreateDeviceId();
  const activeSessionRef = ref(rtdb, `users/${uid}/activeSession`);
  const presenceRef = ref(rtdb, `presence/${uid}/${sessionId}`);
  const infoConnectedRef = ref(rtdb, ".info/connected");

  const payload = {
    sessionId,
    deviceId,
    updatedAt: Date.now(),
    ua: navigator.userAgent,
    platform: navigator.platform || "unknown",
  };

  await runTransaction(activeSessionRef, () => payload);

  let kicked = false;
  const handleKicked = () => {
    if (kicked) return;
    kicked = true;
    if (typeof onKicked === "function") {
      onKicked({ sessionId, deviceId });
    }
  };

  const unsubscribeActiveSession = onValue(activeSessionRef, (snapshot) => {
    if (kicked) return;
    const data = snapshot.val();
    if (!data || !data.sessionId) return;
    if (data.sessionId !== sessionId) {
      handleKicked();
    }
  });

  const unsubscribePresence = onValue(infoConnectedRef, (snapshot) => {
    if (kicked) return;
    if (snapshot.val() === true) {
      set(presenceRef, {
        deviceId,
        connected: true,
        since: Date.now(),
      });
      onDisconnect(presenceRef).remove();
    }
  });

  return () => {
    kicked = true;
    unsubscribeActiveSession();
    unsubscribePresence();
    remove(presenceRef).catch(() => {});
  };
};
