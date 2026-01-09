import React, { useState, useEffect, useRef } from "react";
import {
  ref,
  get,
  push,
  update,
  onValue,
  set as rtdbSet,
  serverTimestamp,
} from "firebase/database"; // serverTimestamp можно импортировать отсюда

import { addMinutes, differenceInSeconds } from "date-fns";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { db, database } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./FightPage.css";

function FightPage({ uid, searchState, setSearchState }) {
  const { isSearching, lobbyId } = searchState;
  const [elapsed, setElapsed] = useState(0);
  const [raidEnterError, setRaidEnterError] = useState(null);

  const [countdown, setCountdown] = useState(null);
  const [playersInLobby, setPlayersInLobby] = useState(0);
  const [introStage, setIntroStage] = useState(null);
  const [tip, setTip] = useState(null);
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");

  const isCancelled = useRef(false);
  const navigate = useNavigate();
  const [showInfoModal, setShowInfoModal] = useState(null);

  // Raid entry confirmation
  const [showRaidConfirm, setShowRaidConfirm] = useState(false);
  const [raidBoss, setRaidBoss] = useState(null); // { name, hp, max_hp, image_url }
  const [userTickets, setUserTickets] = useState(0);
  // --- состояние для двух лидербордов ---
  const [raidLeaderboard, setRaidLeaderboard] = useState([]);
  const [pvpLeaderboard, setPvpLeaderboard] = useState([]);
  const [activeBoard, setActiveBoard] = useState("raid"); // raid | pvp
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [fullLeaderboard, setFullLeaderboard] = useState([]);
  const [modalBoardType, setModalBoardType] = useState("raid");

  // --- Claim state ---
  const [lastClaimAt, setLastClaimAt] = useState(null);
  const [canClaim, setCanClaim] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [claimLoaded, setClaimLoaded] = useState(false);
  const switchLeaderboard = async () => {
    const next = modalBoardType === "raid" ? "pvp" : "raid";
    setModalBoardType(next);

    try {
      const usersCollection = collection(db, "users");
      const leaderboardQuery =
        next === "raid"
          ? query(usersCollection, orderBy("stats.total_damage_raid", "desc"))
          : query(usersCollection, orderBy("stats.RI", "desc"));

      const querySnapshot = await getDocs(leaderboardQuery);
      const playersArray = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        playersArray.push({
          userId: docSnap.id,
          nickname: data.nickname || "Игрок",
          avatar: data.avatar_url || "/default-avatar.png",
          value:
            next === "raid"
              ? data.stats?.total_damage_raid || 0
              : data.stats?.RI || 0,
        });
      });

      setFullLeaderboard(playersArray);
    } catch (error) {
      console.error("Ошибка перелистывания лидерборда:", error);
    }
  };
  useEffect(() => {
    if (showRaidConfirm) {
      setRaidEnterError(null);
    }
  }, [showRaidConfirm]);

  useEffect(() => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);

    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        setUserTickets(snap.data().tickets || 0);
      }
    });
  }, [uid]);

  // загрузка времени claim из DB
  useEffect(() => {
    if (!uid) return;

    const claimRef = ref(database, `users/${uid}/settings/lastClaimAt`);

    return onValue(claimRef, (snap) => {
      const val = snap.val();

      if (!val) setLastClaimAt(null);
      else setLastClaimAt(new Date(val));

      setClaimLoaded(true); // <<< загружено
    });
  }, [uid]);

  // таймер
  useEffect(() => {
    if (!claimLoaded) return; // Данные ещё не получены — ничего не делаем

    if (!lastClaimAt) {
      // Уже точно знаем, что lastClaimAt отсутствует в БД
      setRemaining(0);
      setCanClaim(true);
      return;
    }

    const interval = setInterval(() => {
      const nextTime = addMinutes(lastClaimAt, 30);
      const diff = differenceInSeconds(nextTime, new Date());

      setRemaining(diff > 0 ? diff : 0);

      // canClaim пересчитываем только если изменилось состояние
      setCanClaim((prev) => {
        const nowCanClaim = diff <= 0;
        return prev !== nowCanClaim ? nowCanClaim : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lastClaimAt]);

  // обработчик claim
  const handleClaim = async (type) => {
    if (!canClaim || !type) return;

    // обновляем таймер
    await update(ref(database, `users/${uid}/settings`), {
      lastClaimAt: serverTimestamp(),
    });

    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    const data = snap.data() || {};

    let reward = {
      coins: data.balance || 0,
      SecretRecipes: data.SecretRecipes || 0,
      tickets: data.tickets || 0,
    };

    if (type === "coins") reward.coins += 150;
    if (type === "SecretRecipes") reward.SecretRecipes += 2;
    if (type === "tickets") reward.tickets += 2;

    await updateDoc(userRef, {
      balance: reward.coins,
      SecretRecipes: reward.SecretRecipes,
      tickets: reward.tickets,
    });
  };

  // --- загрузка лидерборда PvP (топ-3 по RI) ---
  useEffect(() => {
    const fetchPvpLeaderboard = async () => {
      try {
        const usersCollection = collection(db, "users");
        const leaderboardQuery = query(
          usersCollection,
          orderBy("stats.RI", "desc"),
          limit(3)
        );
        const querySnapshot = await getDocs(leaderboardQuery);
        const topPlayers = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          topPlayers.push({
            userId: docSnap.id,
            nickname: data.nickname || "Игрок",
            avatar: data.avatar_url || "/default-avatar.png",
            value: data.stats?.RI || 0,
          });
        });
        setPvpLeaderboard(topPlayers);
      } catch (error) {
        console.error("Ошибка загрузки лидерборда PvP:", error);
      }
    };
    fetchPvpLeaderboard();
  }, []);
  useEffect(() => {
    if (!showRaidConfirm) return;

    const bossRef = ref(database, "Raid_BOSS");

    get(bossRef).then((snap) => {
      if (!snap.exists()) {
        setRaidBoss(null);
        return;
      }

      const activeBoss = getActiveRaidBoss(snap.val());

      const normalizedBoss = activeBoss?.finished
        ? activeBoss
        : {
            ...activeBoss,
            hp: activeBoss.hp ?? 0,
            max_hp: activeBoss.max_hp ?? activeBoss.maxHp ?? 0,
            image_url: activeBoss.image_url ?? "/boss-placeholder.png",
          };

      setRaidBoss(normalizedBoss);
    });
  }, [showRaidConfirm]);

  // --- загрузка лидерборда рейда (топ-3) ---
  useEffect(() => {
    const fetchRaidLeaderboard = async () => {
      try {
        const usersCollection = collection(db, "users");
        const leaderboardQuery = query(
          usersCollection,
          orderBy("stats.total_damage_raid", "desc"),
          limit(3)
        );
        const querySnapshot = await getDocs(leaderboardQuery);
        const topPlayers = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          topPlayers.push({
            userId: docSnap.id,
            nickname: data.nickname || "Игрок",
            avatar: data.avatar_url || "/default-avatar.png",
            value: data.stats?.total_damage_raid || 0,
          });
        });
        setRaidLeaderboard(topPlayers);
      } catch (error) {
        console.error("Ошибка загрузки лидерборда рейда:", error);
      }
    };
    fetchRaidLeaderboard();
  }, []);
  // --- автопереключение каждые 6 секунд ---
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBoard((prev) => (prev === "raid" ? "pvp" : "raid"));
    }, 6000);
    return () => clearInterval(interval);
  }, []);
  const getActiveRaidBoss = (bosses) => {
    if (!bosses) return null;

    const stages = Object.values(bosses).sort((a, b) => a.stage - b.stage);

    const active = stages.find((b) => b.hp > 0);

    return active || { finished: true };
  };

  // --- загрузка полного лидерборда по типу ---
  const openLeaderboardModal = async (type = "raid") => {
    setModalBoardType(type);
    setShowLeaderboardModal(true);
    try {
      const usersCollection = collection(db, "users");
      const leaderboardQuery =
        type === "raid"
          ? query(usersCollection, orderBy("stats.total_damage_raid", "desc"))
          : query(usersCollection, orderBy("stats.RI", "desc"));
      const querySnapshot = await getDocs(leaderboardQuery);
      const playersArray = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        playersArray.push({
          userId: docSnap.id,
          nickname: data.nickname || "Игрок",
          avatar: data.avatar_url || "/default-avatar.png",
          value:
            type === "raid"
              ? data.stats?.total_damage_raid || 0
              : data.stats?.RI || 0,
        });
      });
      setFullLeaderboard(playersArray);
    } catch (error) {
      console.error("Ошибка загрузки полного лидерборда:", error);
    }
  };

  const closeLeaderboardModal = () => setShowLeaderboardModal(false);
  const handleOpenProfile = (profileUserId) => {
    setShowLeaderboardModal(false);
    navigate(`/profile/${profileUserId}?start=${uid}`);
  };

  // при старте поиска сбрасываем таймер
  useEffect(() => {
    if (!isSearching || !searchState.startTimestamp) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - searchState.startTimestamp) / 1000);
      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSearching, searchState.startTimestamp]);

  // --- подсказки
  useEffect(() => {
    if (!isSearching) return setTip(null);
    const tips = [
      "💡 Совет: усиливайте карты в коллекции, чтобы увеличить их характеристики.",
      "🎯 Совет: проверьте свою колоду перед боем — сбалансируйте атаку и защиту.",
      "🛡️ Совет: карты с высоким уровнем защиты идеально подходят для сдерживания урона в начале боя.",
      "⚔️ Подсказка: используйте карты с уроном по времени, чтобы истощать противника даже вне активной атаки.",
      "💰 Совет: продавайте дубликаты карт на рынке, чтобы заработать и приобрести недостающие элементы.",
      "🔄 Подсказка: обновляйте колоду регулярно — мета может измениться после добавления новых карт.",
      "📦 Подсказка: открытие ланч-боксов может принести ценные карты",
      "🔧 Совет: настройте колоду под врага — универсальные сборки не всегда эффективны.",
      "⚙️ Подсказка: в рейдах полезны карты с эффектами поддержки и длительным уроном.",
      "📈 Совет: используйте прокачку с умом — приоритет стоит отдавать ключевым картам.",
      "👥 Подсказка: общайтесь с другими игроками — обмен опытом поможет быстрее освоиться в игре.",
    ];
    let tipTimeout;
    const showTip = () => {
      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      setTip(randomTip);
      tipTimeout = setTimeout(showTip, Math.random() * 5000 + 5000);
    };
    showTip();
    return () => clearTimeout(tipTimeout);
  }, [isSearching]);

  // --- старт поиска
  const handleSearchOpponent = async () => {
    if (!uid) return console.error("UID не передан");
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      const deck = userDoc.data()?.deck_pvp || [];
      if (deck.length < 10) {
        alert("Минимум 10 карт!");
        return;
      }
    } catch (err) {
      console.error("Ошибка загрузки колоды:", err);
      return;
    }

    isCancelled.current = false;

    const lobbyRef = ref(database, "lobbies");
    const snapshot = await get(lobbyRef);
    const lobbies = snapshot.val() || {};
    let joinedLobbyId = null;

    for (const id in lobbies) {
      const lobby = lobbies[id];
      const players = lobby.players || [];
      if (
        players.length === 1 &&
        lobby.status === "waiting" &&
        !players.includes(uid)
      ) {
        const updatedPlayers = [...players, uid];
        await update(ref(database, `lobbies/${id}`), {
          players: updatedPlayers,
        });
        joinedLobbyId = id;
        break;
      }
    }

    if (!joinedLobbyId) {
      const newLobbyRef = push(lobbyRef);
      joinedLobbyId = newLobbyRef.key;
      await rtdbSet(newLobbyRef, {
        players: [uid],
        status: "waiting",
        countdown: null,
      });
    }
    setSearchState({
      isSearching: true,
      searchStartPath: `/fight?start=${uid}`,
      startTimestamp: Date.now(), // 👈 фиксированная точка отсчёта
      lobbyId: joinedLobbyId,
    });
  };

  // --- отмена поиска
  const handleCancelSearch = async () => {
    isCancelled.current = true;
    if (!lobbyId) {
      setSearchState({
        isSearching: false,
        searchStartPath: null,
        secondsElapsed: 0,
        lobbyId: null,
      });
      return;
    }

    const lobbyRef = ref(database, `lobbies/${lobbyId}`);
    const snapshot = await get(lobbyRef);
    const lobby = snapshot.val();

    if (lobby) {
      if (lobby.players?.length === 1 && lobby.players[0] === uid) {
        await rtdbSet(lobbyRef, null);
      } else {
        const updatedPlayers = lobby.players.filter((p) => p !== uid);
        await update(lobbyRef, { players: updatedPlayers });
      }
    }

    setSearchState({
      isSearching: false,
      searchStartPath: null,
      secondsElapsed: 0,
      lobbyId: null,
    });

    setPlayersInLobby(0);
    setCountdown(null);
    setIntroStage(null);
  };

  // --- подписка на изменения в лобби
  useEffect(() => {
    if (!lobbyId) return;
    const lobbyRef = ref(database, `lobbies/${lobbyId}`);
    const unsubscribe = onValue(lobbyRef, async (snapshot) => {
      const lobby = snapshot.val();
      if (!lobby) {
        setSearchState({
          isSearching: false,
          searchStartPath: null,
          secondsElapsed: 0,
          lobbyId: null,
        });
        setPlayersInLobby(0);
        setCountdown(null);
        setIntroStage(null);
        return;
      }

      const playersCount = lobby.players?.length || 0;
      setPlayersInLobby(playersCount);
      if (typeof lobby.countdown === "number") setCountdown(lobby.countdown);

      if (
        playersCount === 2 &&
        lobby.status === "waiting" &&
        lobby.players[0] === uid
      ) {
        await update(lobbyRef, { status: "Play", countdown: 3 });
        const interval = setInterval(async () => {
          const snap = await get(lobbyRef);
          const curr = snap.val();
          if (!curr || curr.countdown == null) {
            clearInterval(interval);
            return;
          }
          if (curr.countdown > 0) {
            await update(lobbyRef, { countdown: curr.countdown - 1 });
          } else {
            clearInterval(interval);
          }
        }, 1000);
      }

      if (
        playersCount === 2 &&
        lobby.status === "Play" &&
        lobby.countdown === 0
      ) {
        const [uid1, uid2] = lobby.players;
        try {
          const doc1 = await getDoc(doc(db, "users", uid1));
          const doc2 = await getDoc(doc(db, "users", uid2));
          setPlayer1Name(
            doc1.exists() ? doc1.data().nickname || "Игрок 1" : "Игрок 1"
          );
          setPlayer2Name(
            doc2.exists() ? doc2.data().nickname || "Игрок 2" : "Игрок 2"
          );

          setIntroStage("player1");
          setTimeout(() => setIntroStage("vs"), 1500);
          setTimeout(() => setIntroStage("player2"), 3000);
          setTimeout(() => setIntroStage("countdown"), 4500);
          setTimeout(() => {
            setIntroStage(null);
            navigate(`/Game?start=${uid}&lobby=${lobbyId}`);
          }, 6500);
        } catch (error) {
          console.error("Ошибка загрузки имён:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [lobbyId, uid, navigate, setSearchState]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };
  return (
    <div>
      <div style={{ position: "relative", zIndex: 10 }}>
        {/* --- Лидерборд в правом верхнем углу --- */}
        <div
          className="leaderboard-container"
          onClick={() => openLeaderboardModal(activeBoard)}
          title="Кликните для просмотра полного списка"
          style={{
            width: 200,
            padding: "6px 8px",
            borderRadius: 8,
            fontSize: 14,
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: 14 }}>
            {activeBoard === "raid" ? "Лидерборд рейда" : "Лидерборд PvP"}
          </h4>

          {/* 👇 ключ заставит React пересоздать div при смене activeBoard */}
          <div key={activeBoard} className="leaderboard-switch">
            {(activeBoard === "raid" ? raidLeaderboard : pvpLeaderboard)
              .length === 0 && <p>Загрузка...</p>}
            {(activeBoard === "raid" ? raidLeaderboard : pvpLeaderboard).map(
              (player, index) => (
                <div
                  key={player.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "2px 0",
                  }}
                >
                  <span style={{ fontWeight: "bold", width: 18 }}>
                    {index + 1}.
                  </span>
                  <img
                    src={player.avatar}
                    alt={player.nickname}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flexGrow: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      lineHeight: 1,
                    }}
                  >
                    {player.nickname}
                  </span>
                  <span
                    style={{
                      fontWeight: "bold",
                      minWidth: 40,
                      textAlign: "right",
                      lineHeight: 1,
                    }}
                  >
                    {player.value.toLocaleString()}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
        {/* --- Claim widget --- */}
        <div
          className={`claim-widget_FightPage ${
            showClaimModal ? "hidden-claim_FightPage" : ""
          }`}
          onClick={() => setShowClaimModal(true)}
        >
          <img src="/moneta.png" alt="coin" />

          {claimLoaded && lastClaimAt !== null && canClaim && (
            <div className="claim-alert_FightPage">!</div>
          )}
        </div>
        {showClaimModal && (
          <div
            className="claim-overlay_FightPage"
            onClick={() => setShowClaimModal(false)}
          >
            <div
              className="claim-window_FightPage"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="claim-title_FightPage">Выберите награду</h3>

              {/* Вариант: 100 монет */}
              <div
                className={`claim-reward_FightPage selectable_FightPage ${
                  selectedReward === "coins" ? "selected_FightPage" : ""
                }`}
                onClick={() => setSelectedReward("coins")}
              >
                <img
                  src="/moneta.png"
                  alt="coins"
                  className="claim-coin_FightPage"
                />
                <span className="claim-amount_FightPage">× 100</span>
              </div>

              <div className="claim-or_FightPage">ИЛИ</div>

              {/* Вариант: 10 рецептов */}
              <div
                className={`claim-reward_FightPage selectable_FightPage ${
                  selectedReward === "SecretRecipes" ? "selected_FightPage" : ""
                }`}
                onClick={() => setSelectedReward("SecretRecipes")}
              >
                <img
                  src="/666666.png"
                  alt="SecretRecipes"
                  className="claim-coin_FightPage"
                />
                <span className="claim-amount_FightPage">× 10</span>
              </div>

              <div className="claim-or_FightPage">ИЛИ</div>

              {/* Вариант: 5 билетов */}
              <div
                className={`claim-reward_FightPage selectable_FightPage ${
                  selectedReward === "tickets" ? "selected_FightPage" : ""
                }`}
                onClick={() => setSelectedReward("tickets")}
              >
                <img
                  src="/ticket.png"
                  alt="tickets"
                  className="claim-coin_FightPage"
                />
                <span className="claim-amount_FightPage">× 5</span>
              </div>

              {canClaim && (
                <button
                  disabled={!selectedReward}
                  className="claim-button_FightPage"
                  onClick={async () => {
                    await handleClaim(selectedReward);
                    setShowClaimModal(false);
                  }}
                >
                  Забрать
                </button>
              )}

              {!canClaim && (
                <div className="claim-timer_FightPage">
                  Доступно через:{" "}
                  <span className="claim-timer-value_FightPage">
                    {Math.floor(remaining / 60)}:
                    {(remaining % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {showInfoModal && (
          <div className="modal-overlay" onClick={() => setShowInfoModal(null)}>
            <div
              className="modal-window"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 500 }}
            >
              <h3>{showInfoModal === "pvp" ? "PvP режим" : "Режим Рейд"}</h3>
              <p>
                {showInfoModal === "pvp"
                  ? "В режиме PvP вы сражаетесь против других игроков. Для начала матча необходимо минимум 10 карт в колоде PvP. Победа дает награды и повышает ваш рейтинг."
                  : "В режиме Рейд вы сражаетесь против могущественных боссов. Используйте особые стратегии, чтобы нанести как можно больше урона. Требуется минимум 7 карт в колоде Raid. "}
              </p>
            </div>
          </div>
        )}

        {/* --- Модальное окно полного лидерборда --- */}
        {showLeaderboardModal && (
          <div className="modal-overlay" onClick={closeLeaderboardModal}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: "80vh", overflowY: "auto" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <h3 style={{ margin: 0 }}>
                  {modalBoardType === "raid"
                    ? "Лидерборд Рейда"
                    : "Лидерборд Дуэли"}
                </h3>
                <ArrowForwardIosIcon
                  onClick={switchLeaderboard}
                  style={{ cursor: "pointer", fontSize: 26 }}
                />
              </div>

              {fullLeaderboard.length === 0 && <p>Загрузка...</p>}
              {fullLeaderboard.map((player, index) => (
                <div
                  key={player.userId}
                  className="player-row"
                  title={`${player.nickname} — ${
                    modalBoardType === "raid" ? "урон" : "RI"
                  }: ${player.value}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 0",
                    borderBottom: "1px solid #333",
                    cursor: "pointer",
                  }}
                  onClick={() => handleOpenProfile(player.userId)}
                >
                  <span style={{ fontWeight: "bold", width: 24 }}>
                    {index + 1}.
                  </span>
                  <img
                    src={player.avatar}
                    alt={player.nickname}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                  <span
                    style={{
                      flexGrow: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {player.nickname}
                  </span>
                  <span
                    style={{
                      fontWeight: "bold",
                      minWidth: 60,
                      textAlign: "right",
                    }}
                  >
                    {player.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {introStage && (
        <div className="fight-countdown-overlay">
          {introStage === "player1" && <p>⚔️ {player1Name}</p>}
          {introStage === "vs" && <p>против</p>}
          {introStage === "player2" && <p>🛡️ {player2Name}</p>}
          {introStage === "countdown" && <p>1 Раунд!</p>}
        </div>
      )}

      {tip && <div className="fight-tip">{tip}</div>}

      {isSearching && playersInLobby < 2 && (
        <div className="fight-overlay">
          <div className="fight-spinner"></div>
          <p className="fight-time">{formatTime(elapsed)}</p>
          <button className="fight-btn-cancel" onClick={handleCancelSearch}>
            Отменить поиск
          </button>
        </div>
      )}

      {playersInLobby === 2 && countdown > 0 && (
        <div className="fight-countdown-overlay">
          <p>Игра начнется через {countdown}</p>
        </div>
      )}

      <div
        className={`fight-container ${
          isSearching || playersInLobby === 2 ? "disabled" : ""
        }`}
      >
        {!isSearching && playersInLobby < 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="fight-btn-search"
                onClick={handleSearchOpponent}
              >
                Дуэль
              </button>
              <button
                className="info-button"
                title="О режиме PvP"
                onClick={() => setShowInfoModal("pvp")}
              >
                i
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="fight-btn-raid"
                onClick={async () => {
                  try {
                    const userDoc = await getDoc(doc(db, "users", uid));
                    const data = userDoc.data();
                    const raidDeck = data?.deck_raid || [];

                    if (raidDeck.length < 7) {
                      alert(
                        "Для участия в рейде необходимо минимум 7 карт в колоде raid!"
                      );
                      return;
                    }

                    // ❗ НИКАКОЙ проверки билетов здесь
                    setShowRaidConfirm(true);

                    // 🔹 Заглушка босса (источник подключишь позже)
                    setRaidBoss({
                      name: "Загрузка",
                      hp: "???",
                      max_hp: "???",
                      image_url: "/boss-placeholder.png",
                    });

                    setShowRaidConfirm(true);
                  } catch (error) {
                    console.error("Ошибка подготовки рейда:", error);
                    alert("Ошибка загрузки данных. Попробуйте позже.");
                  }
                }}
              >
                Рейд
              </button>

              <button
                className="info-button"
                title="О режиме Рейд"
                onClick={() => setShowInfoModal("raid")}
              >
                i
              </button>
            </div>
          </>
        )}
      </div>
      {showRaidConfirm && (
        <div
          className="raid-confirm-modal-overlay"
          onClick={() => setShowRaidConfirm(false)}
        >
          <div
            className="raid-confirm-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {raidBoss?.finished ? (
              <>
                <h3 className="raid-finished-title">Все боссы повержены</h3>
                <p className="raid-finished-sub">
                  Ожидайте следующего рейд-сезона
                </p>
                <button
                  className="raid-btn-cancel"
                  onClick={() => setShowRaidConfirm(false)}
                >
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <img
                  src={raidBoss.image_url || "/boss-placeholder.png"}
                  alt={raidBoss.name}
                  className="raid-confirm-modal-boss-image"
                />

                <h3 className="raid-confirm-modal-boss-name">
                  {raidBoss.name}
                </h3>

                <div className="raid-confirm-modal-hp-bar">
                  <div
                    className="raid-confirm-modal-hp-fill"
                    style={{
                      width: `${
                        raidBoss.max_hp
                          ? Math.max(2, (raidBoss.hp / raidBoss.max_hp) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <div className="raid-confirm-modal-hp-text">
                  {raidBoss.hp?.toLocaleString() ?? "—"} /{" "}
                  {raidBoss.max_hp?.toLocaleString() ?? "—"} HP
                </div>

                <p className="raid-confirm-modal-ticket">
                  Стоимость входа:
                  <img
                    src="/ticket.png"
                    alt="ticket"
                    className="raid-confirm-modal-ticket-icon"
                  />
                  <strong>1 билет</strong>
                </p>

                <div className="raid-confirm-modal-actions">
                  <button
                    className="raid-confirm-modal-btn-cancel"
                    onClick={() => setShowRaidConfirm(false)}
                  >
                    Отмена
                  </button>
                  {raidEnterError && (
                    <div className="raid-confirm-modal-error">
                      {raidEnterError}
                    </div>
                  )}

                  <button
                    className="raid-confirm-modal-btn-enter"
                    onClick={async () => {
                      if (userTickets < 1) {
                        setRaidEnterError(
                          "Недостаточно билетов для входа в рейд"
                        );
                        return;
                      }

                      await updateDoc(doc(db, "users", uid), {
                        tickets: userTickets - 1,
                      });

                      setShowRaidConfirm(false);
                      navigate(`/Raid?start=${uid}`);
                    }}
                  >
                    Войти в рейд
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FightPage;
