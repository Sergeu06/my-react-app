// game-logic/initGame.js
import { doc, getDoc, db, database } from "../firebase";
import { setEnergy } from "./energyManager";
export default async function initGame(uid, opponentUid, lobbyId) {
  console.log("[InitGame] start", { uid, opponentUid, lobbyId });

  try {
    const [snap1, snap2] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDoc(doc(db, "users", opponentUid)),
    ]);

    const p1 = snap1.exists() ? snap1.data() : {};
    const p2 = snap2.exists() ? snap2.data() : {};

    const p1Lvl = Number(p1.stats?.lvl) || 1;
    const p2Lvl = Number(p2.stats?.lvl) || 1;

    // XP берём из users/{uid}/stats/xp (если нет — 0)
    const p1Xp = Number(p1.stats?.xp ?? p1.xp) || 0;
    const p2Xp = Number(p2.stats?.xp ?? p2.xp) || 0;

    const calcMaxHp = (lvl) => Math.round(50 + 5 * lvl);

    const player = {
      nickname: p1.nickname || "Игрок 1",
      avatar_url: p1.avatar_url || null, // 👈 вот это
      lvl: p1Lvl,
      xp: p1Xp,
      hp: calcMaxHp(p1Lvl),
      maxHp: calcMaxHp(p1Lvl),
      hand: [],
      deck: [],
      recipes: 3,
    };

    const opponent = {
      nickname: p2.nickname || "Игрок 2",
      avatar_url: p2.avatar_url || null, // 👈 вот это
      lvl: p2Lvl,
      xp: p2Xp,
      hp: calcMaxHp(p2Lvl),
      maxHp: calcMaxHp(p2Lvl),
      hand: new Array(4).fill("hidden"), // например 4 карты
      deck: [],
      recipes: 3,
    };

    console.log("[InitGame] loaded profiles", {
      player: {
        uid,
        lvl: player.lvl,
        xp: player.xp,
        hp: player.hp,
        maxHp: player.maxHp,
      },
      opponent: {
        uid: opponentUid,
        lvl: opponent.lvl,
        xp: opponent.xp,
        hp: opponent.hp,
        maxHp: opponent.maxHp,
      },
    });

    await Promise.all([
      setEnergy(database, lobbyId, uid, 3),
      setEnergy(database, lobbyId, opponentUid, 3),
    ]);

    return { players: { [uid]: player, [opponentUid]: opponent } };
    return { players: { [uid]: player, [opponentUid]: opponent } };
  } catch (e) {
    console.error("[InitGame] failed, fallback to defaults", e);
    const fallback = (lvl = 1) => Math.round(100 * (1.3 * lvl));

    return {
      players: {
        [uid]: {
          nickname: "Игрок 1",
          lvl: 1,
          xp: 0,
          hp: fallback(1),
          maxHp: fallback(1),
          hand: [],
          deck: [],
          recipes: 3,
        },
        [opponentUid]: {
          nickname: "Игрок 2",
          lvl: 1,
          xp: 0,
          hp: fallback(1),
          maxHp: fallback(1),
          hand: [],
          deck: [],
          recipes: 3,
        },
      },
    };
  }
}
