import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  databaseRef,
  get,
  doc,
  getDoc,
  updateDoc,
  database,
  db,
  update,
  set as rtdbSet
} from "./firebase";
import { useUser } from "./UserContext";
import "./ResultPage.css";

function calculateLevel(xp) {
  const baseXp = 100;
  const multiplier = 1.5;
  let level = 0;
  let xpNeeded = baseXp;
  while (xp >= xpNeeded) {
    level++;
    xp -= xpNeeded;
    xpNeeded = Math.floor(xpNeeded * multiplier);
  }
  return level;
}

export default function ResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userData } = useUser();
  const uid = userData?.uid || null;

  const lobbyId = searchParams.get("lobby");
  const start = searchParams.get("start");
  const [result, setResult] = useState(null);

  const [animatedCoins, setAnimatedCoins] = useState(0);
  const [animatedExp, setAnimatedExp] = useState(0);
  const [animatedRi, setAnimatedRi] = useState(0);

  useEffect(() => {
    if (!lobbyId) return;
    (async () => {
      try {
        const snap = await get(databaseRef(database, `lobbies/${lobbyId}`));
        if (snap.exists()) {
          const lobbyData = snap.val();
          setResult({
            winner: lobbyData.winner,
            loser: lobbyData.loser,
            endReason: lobbyData.endReason || null,
            roundsPlayed: lobbyData.round || 1, // берём из RTDB
            players: lobbyData.players || {},
          });
        }
      } catch (err) {
        console.error("[ResultPage] Ошибка загрузки результата", err);
      }
    })();
  }, [lobbyId]);

  useEffect(() => {
    if (!uid || !result) return;

    const isWin = result.winner === start;
    const isDisconnectLoss = !isWin && result.endReason === "disconnect";
    const coins = isWin ? 250 : isDisconnectLoss ? 0 : 150;
    const exp = isWin ? 100 : isDisconnectLoss ? 0 : 50;

    const userRef = doc(db, "users", uid);

    const fetchDeckFromFirestore = async (uid) => {
      const docSnap = await getDoc(doc(db, "users", uid));
      if (!docSnap.exists()) return [];
      return docSnap.data().deck_pvp || [];
    };

    const fetchCardsFromRTDB = async (keys) => {
      const cards = [];
      for (const key of keys) {
        const snap = await get(databaseRef(database, `cards/${key}`));
        if (snap.exists()) cards.push(snap.val());
      }
      return cards;
    };

    (async () => {
      const playerCardKeys = await fetchDeckFromFirestore(start);
      const opponentId = isWin ? result.loser : result.winner;
      const opponentCardKeys = await fetchDeckFromFirestore(opponentId);

      const playerDeck = await fetchCardsFromRTDB(playerCardKeys);
      const opponentDeck = await fetchCardsFromRTDB(opponentCardKeys);

      const playerPower = playerDeck.reduce((sum, c) => sum + (c.lvl || 0), 0);
      const opponentPower = opponentDeck.reduce(
        (sum, c) => sum + (c.lvl || 0),
        0
      );

      const roundsPlayed = result.roundsPlayed;
      const maxRounds = 15;

      // Лог количества раундов
      console.log(`[ResultPage] Количество раундов (из RTDB): ${roundsPlayed}`);

      // Таблица карт игрока
      console.log("[ResultPage] Карты игрока:");
      console.table(
        playerDeck.map((card) => ({
          Карта: card.name,
          Уровень: card.lvl || 0,
          "Сумма уровней": playerPower,
        }))
      );

      // Таблица карт соперника
      console.log("[ResultPage] Карты соперника:");
      console.table(
        opponentDeck.map((card) => ({
          Карта: card.name,
          Уровень: card.lvl || 0,
          "Сумма уровней": opponentPower,
        }))
      );

      // Расчет РИ
      let riEarned = 0;
      if (isWin) {
        riEarned = Math.round(
          Math.min(
            30,
            Math.max(
              0,
              10 +
                20 * (opponentPower / (playerPower + opponentPower || 1)) +
                10 * (roundsPlayed / maxRounds)
            )
          )
        );
      } else {
        riEarned = -Math.round(
          Math.min(
            30,
            Math.max(
              10,
              10 +
                10 * (playerPower / (playerPower + opponentPower || 1)) +
                5 * (roundsPlayed / maxRounds)
            )
          )
        );
      }

      // Обновление статистики с RI
      await updateDoc(userRef, {
        balance: (userData?.balance || 0) + coins,
        stats: {
          ...(userData?.stats || {}),
          xp: (userData?.stats?.xp || 0) + exp,
          lvl: calculateLevel((userData?.stats?.xp || 0) + exp),
          wins: (userData?.stats?.wins || 0) + (isWin ? 1 : 0),
          losses: (userData?.stats?.losses || 0) + (!isWin ? 1 : 0),
          RI: (userData?.stats?.RI ?? 1000) + riEarned, // <-- старт 1000 RI
          rating: (userData?.stats?.rating || 0) + riEarned,
        },
      });

      animateValue(setAnimatedCoins, 0, coins, 1000);
      animateValue(setAnimatedExp, 0, exp, 1000);
      setAnimatedRi(riEarned);
    })();
  }, [result, uid]);

  function animateValue(setter, start, end, duration) {
    const startTime = performance.now();
    function update(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setter(Math.floor(start + (end - start) * progress));
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  if (!result) return <div className="loading">Загрузка результата...</div>;

  const isWin = result.winner === start;
  const handleBackToMenu = async () => {
    try {
      if (lobbyId && start) {
        const lobbyRef = databaseRef(database, `lobbies/${lobbyId}`);
        const snap = await get(lobbyRef);
        const lobby = snap.val();

        if (lobby?.players?.length) {
          const updatedPlayers = lobby.players.filter((p) => p !== start);

          if (updatedPlayers.length === 0) {
            await rtdbSet(lobbyRef, null); // ✅ удалить лобби полностью
          } else {
            await update(lobbyRef, { players: updatedPlayers });
          }
        }
      }
    } catch (e) {
      console.warn("[ResultPage] lobby cleanup failed:", e);
    }

    navigate(`/fight?start=${start}&resetSearch=1`);
  };
  return (
    <div className="result-page-new">
      <div className="result-card">
        <h1 className={`result-header ${isWin ? "win" : "lose"}`}>
          {isWin ? "ПОБЕДА" : "ПОРАЖЕНИЕ"}
        </h1>
        <div className="rewards">
          <div className="reward-item">
            <span className="reward-label">Монеты</span>
            <span className="reward-value coins">{animatedCoins}</span>
          </div>
          <div className="reward-item">
            <span className="reward-label">Опыт</span>
            <span className="reward-value exp">{animatedExp}</span>
          </div>
          <div className="reward-item">
            <span className="reward-label">РИ</span>
            <span
              className={`reward-value rating ${
                animatedRi >= 0 ? "positive" : "negative"
              }`}
            >
              {animatedRi > 0 ? `+${animatedRi}` : animatedRi}
            </span>
          </div>
        </div>
        <button className="back-button" onClick={handleBackToMenu}>
          Вернуться в меню
        </button>
      </div>
    </div>
  );
}
