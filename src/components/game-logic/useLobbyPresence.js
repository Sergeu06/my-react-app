import { useEffect, useRef } from "react";
import {
  databaseRef,
  onValue,
  off,
  set,
  update,
  onDisconnect,
  runDatabaseTransaction,
} from "../firebase";

const createSessionId = () =>
  `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const DEFAULT_GRACE_MS = 10000;
const DEFAULT_HEARTBEAT_MS = 4000;

const isOpponentOffline = ({ presence, now, graceMs }) => {
  if (!presence || presence.state !== "online") return true;
  if (!presence.lastSeen) return true;
  return now - presence.lastSeen > graceMs;
};

const endMatchByDisconnect = async ({ lobbyRef, winner, loser }) => {
  await runDatabaseTransaction(lobbyRef, (current) => {
    if (!current) return current;
    if (current.status === "end") return current;

    return {
      ...current,
      status: "end",
      winner,
      loser,
      endedAt: Date.now(),
      endReason: "disconnect",
    };
  });
};

const useLobbyPresence = ({
  database,
  lobbyId,
  uid,
  opponentUid,
  graceMs = DEFAULT_GRACE_MS,
  heartbeatMs = DEFAULT_HEARTBEAT_MS,
}) => {
  const sessionIdRef = useRef(createSessionId());
  const opponentPresenceRef = useRef(null);
  const judgeCooldownRef = useRef(false);

  useEffect(() => {
    if (!database || !lobbyId || !uid) return;

    const sessionId = sessionIdRef.current;
    const presenceRef = databaseRef(
      database,
      `lobbies/${lobbyId}/presence/${uid}`
    );
    const infoConnectedRef = databaseRef(database, ".info/connected");

    const setOnline = () =>
      set(presenceRef, {
        sessionId,
        state: "online",
        lastSeen: Date.now(),
      });

    const markOffline = () =>
      update(presenceRef, {
        state: "offline",
        lastSeen: Date.now(),
      });

    const handleConnected = (snapshot) => {
      if (snapshot.val() === true) {
        setOnline();
        onDisconnect(presenceRef).update({
          state: "offline",
          lastSeen: Date.now(),
        });
      }
    };

    onValue(infoConnectedRef, handleConnected);

    const heartbeatId = setInterval(() => {
      update(presenceRef, {
        sessionId,
        state: "online",
        lastSeen: Date.now(),
      });
    }, heartbeatMs);

    const handlePageHide = () => {
      markOffline();
    };

    window.addEventListener("beforeunload", handlePageHide);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      off(infoConnectedRef, "value", handleConnected);
      clearInterval(heartbeatId);
      window.removeEventListener("beforeunload", handlePageHide);
      window.removeEventListener("pagehide", handlePageHide);
      markOffline();
    };
  }, [database, lobbyId, uid, heartbeatMs]);

  useEffect(() => {
    if (!database || !lobbyId || !uid || !opponentUid) return;

    const presenceListRef = databaseRef(database, `lobbies/${lobbyId}/presence`);
    const lobbyRef = databaseRef(database, `lobbies/${lobbyId}`);

    const handlePresenceUpdate = (snapshot) => {
      const allPresence = snapshot.val() || {};
      opponentPresenceRef.current = allPresence[opponentUid] || null;
    };

    onValue(presenceListRef, handlePresenceUpdate);

    const judgeInterval = setInterval(() => {
      if (judgeCooldownRef.current) return;
      const now = Date.now();
      const opponentPresence = opponentPresenceRef.current;
      if (!isOpponentOffline({ presence: opponentPresence, now, graceMs })) {
        return;
      }
      judgeCooldownRef.current = true;
      endMatchByDisconnect({ lobbyRef, winner: uid, loser: opponentUid })
        .catch((error) => {
          console.error("[PresenceJudge] end match failed", error);
        })
        .finally(() => {
          setTimeout(() => {
            judgeCooldownRef.current = false;
          }, graceMs);
        });
    }, Math.max(1000, Math.floor(graceMs / 2)));

    return () => {
      off(presenceListRef, "value", handlePresenceUpdate);
      clearInterval(judgeInterval);
    };
  }, [database, lobbyId, uid, opponentUid, graceMs]);
};

export default useLobbyPresence;
