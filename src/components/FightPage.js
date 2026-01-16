import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ref,
  get,
  push,
  update,
  onValue,
  set as rtdbSet,
  serverTimestamp,
} from "firebase/database"; // serverTimestamp можно импортировать отсюда

import { addMinutes, addHours, differenceInSeconds } from "date-fns";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

import { db, database } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./FightPage.css";
import "./raid-boss/boss-container.css";
import CachedImage from "../utils/CachedImage";
import {
  ensureDailyTasks,
  completeDailyTask,
  claimDailyTask,
} from "../utils/dailyTasks";
import { formatRaidCountdown, getRaidEventInfo } from "../utils/raidEvents";

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
  const [raidEvent, setRaidEvent] = useState(null);
  const [eventCountdown, setEventCountdown] = useState(0);
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

  const [lastDailyBoxClaimAt, setLastDailyBoxClaimAt] = useState(null);
  const [canDailyBoxClaim, setCanDailyBoxClaim] = useState(false);
  const [dailyBoxRemaining, setDailyBoxRemaining] = useState(0);
  const [showDailyBoxModal, setShowDailyBoxModal] = useState(false);
  const [selectedDailyBox, setSelectedDailyBox] = useState(null);
  const [dailyBoxReward, setDailyBoxReward] = useState(null);
  const [dailyBoxLoaded, setDailyBoxLoaded] = useState(false);
  const [dailyBoxes, setDailyBoxes] = useState([]);
  const [dailyBoxesLoading, setDailyBoxesLoading] = useState(false);
  const [showDailyTasksModal, setShowDailyTasksModal] = useState(false);
  const [dailyTaskState, setDailyTaskState] = useState({});
  const [dailyTasksLoaded, setDailyTasksLoaded] = useState(false);

  const dailyTasks = useMemo(
    () => [
      {
        id: "daily_duel",
        title: "Быстрая дуэль",
        description: "Сыграйте 1 PvP матч.",
        reward: { coins: 120 },
        rewardLabel: "+120 монет",
      },
      {
        id: "daily_raid",
        title: "Рейдовая вылазка",
        description: "Сыграйте 1 рейд.",
        reward: { tickets: 1 },
        rewardLabel: "+1 билет",
      },
      {
        id: "daily_upgrade",
        title: "Лёгкая прокачка",
        description: "Улучшите карту 1 раз.",
        reward: { SecretRecipes: 2 },
        rewardLabel: "+2 SecretRecipes",
      },
      {
        id: "daily_shop",
        title: "Пополнение запасов",
        description: "Купите 1 карту у поставщика.",
        reward: { coins: 80 },
        rewardLabel: "+80 монет",
      },
      {
        id: "daily_collection",
        title: "Наведение порядка",
        description: "Откройте коллекцию карт.",
        reward: { tickets: 1 },
        rewardLabel: "+1 билет",
      },
    ],
    []
  );
  const dailyTaskIds = useMemo(
    () => dailyTasks.map((task) => task.id),
    [dailyTasks]
  );
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
    const updateEvent = () => {
      const { event, secondsRemaining } = getRaidEventInfo();
      setRaidEvent(event);
      setEventCountdown(secondsRemaining);
    };

    updateEvent();
    const timer = setInterval(updateEvent, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!uid) return;
    const userRef = doc(db, "users", uid);

    getDoc(userRef).then((snap) => {
      if (snap.exists()) {
        setUserTickets(snap.data().tickets || 0);
      }
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let unsubscribe;

    const initDailyTasks = async () => {
      await ensureDailyTasks(database, uid, dailyTaskIds);
      const tasksRef = ref(database, `users/${uid}/settings/dailyTasks`);
      unsubscribe = onValue(tasksRef, (snap) => {
        const data = snap.val() || {};
        setDailyTaskState(data.tasks || {});
        setDailyTasksLoaded(true);
      });
    };

    initDailyTasks();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [dailyTaskIds, uid]);

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

  useEffect(() => {
    if (!uid) return;

    const dailyClaimRef = ref(
      database,
      `users/${uid}/settings/lastDailyBoxClaimAt`
    );

    return onValue(dailyClaimRef, (snap) => {
      const val = snap.val();
      if (!val) setLastDailyBoxClaimAt(null);
      else setLastDailyBoxClaimAt(new Date(val));
      setDailyBoxLoaded(true);
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const dailyRewardRef = ref(
      database,
      `users/${uid}/settings/dailyBoxReward`
    );

    return onValue(dailyRewardRef, (snap) => {
      setDailyBoxReward(snap.val() || null);
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

  useEffect(() => {
    if (!dailyBoxLoaded) return;
    if (dailyBoxReward) {
      setDailyBoxRemaining(0);
      setCanDailyBoxClaim(false);
      return;
    }

    if (!lastDailyBoxClaimAt) {
      setDailyBoxRemaining(0);
      setCanDailyBoxClaim(true);
      return;
    }

    const interval = setInterval(() => {
      const nextTime = addHours(lastDailyBoxClaimAt, 24);
      const diff = differenceInSeconds(nextTime, new Date());

      setDailyBoxRemaining(diff > 0 ? diff : 0);
      setCanDailyBoxClaim((prev) => {
        const nowCanClaim = diff <= 0;
        return prev !== nowCanClaim ? nowCanClaim : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [dailyBoxLoaded, dailyBoxReward, lastDailyBoxClaimAt]);

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

  const handleDailyBoxClaim = async () => {
    if (!canDailyBoxClaim || !selectedDailyBox) return;

    await update(ref(database, `users/${uid}/settings`), {
      lastDailyBoxClaimAt: serverTimestamp(),
      dailyBoxReward: {
        boxId: selectedDailyBox.id,
        name: selectedDailyBox.name || "Лутбокс",
        image_url: selectedDailyBox.image_url || "",
      },
    });

    setShowDailyBoxModal(false);
    setSelectedDailyBox(null);
  };

  const handleDailyTaskClaim = async (task) => {
    if (!uid) return;
    const state = dailyTaskState?.[task.id];
    if (!state?.completed || state?.claimed) return;

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userDoc = userSnap.data();

    const updates = {};
    if (task.reward?.coins) {
      updates.balance = (userDoc.balance ?? 0) + task.reward.coins;
    }
    if (task.reward?.tickets) {
      updates.tickets = (userDoc.tickets ?? 0) + task.reward.tickets;
    }
    if (task.reward?.SecretRecipes) {
      updates.SecretRecipes =
        (userDoc.SecretRecipes ?? 0) + task.reward.SecretRecipes;
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }

    await claimDailyTask(database, uid, dailyTaskIds, task.id);
  };

  useEffect(() => {
    if (!showDailyBoxModal || dailyBoxesLoading || dailyBoxes.length > 0)
      return;

    const fetchDailyBoxes = async () => {
      try {
        setDailyBoxesLoading(true);
        const snapshot = await getDocs(collection(db, "box"));
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setDailyBoxes(data);
      } catch (error) {
        console.error("Ошибка загрузки боксов:", error);
      } finally {
        setDailyBoxesLoading(false);
      }
    };

    fetchDailyBoxes();
  }, [showDailyBoxModal, dailyBoxesLoading, dailyBoxes.length]);

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
      "💡 Подсказка: множители урона складываются в один эффект и имеют ограниченное число ходов — не тратьте их на пустой стол.",
      "🎯 Совет: эффект множителя применяется к урону и поэтапному урону — старайтесь разыгрывать DoT после усиления.",
      "🛡️ Подсказка: карты лечения срабатывают сразу и могут спасти от поражения в последний момент.",
      "⚔️ Подсказка: DoT-урон тикает несколько ходов подряд — это помогает пробивать защиту и давление без прямых атак.",
      "🔄 Совет: если рука «залипла», разыгрывайте дешёвые карты — добор в новых раундах возвращает сброшенные карты.",
      "📦 Подсказка: ланч-боксы лучше открывать сериями — шанс редких карт ощущается выше при накоплении.",
      "🔧 Совет: при нехватке энергии тратьте сначала карты с высоким эффектом на стоимость, а не самые дорогие.",
      "⚙️ Подсказка: в рейдах полезны карты, которые усиливают урон на несколько ходов — это увеличивает итоговый DPS.",
      "💰 Совет: дубликаты лучше продавать после апгрейда ключевых карт — так вы не теряете потенциал сборки.",
      "📈 Подсказка: следите за таймером — приоритет хода может менять порядок срабатывания одинаковых карт.",
      "👥 Совет: обменивайтесь стратегиями — знание меты помогает подбирать контр-карты к популярным колодам.",
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
    await completeDailyTask(database, uid, dailyTaskIds, "daily_duel");

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
                  <CachedImage
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
        <div
          className={`claim-widget_FightPage claim-widget_FightPage--purple ${
            showDailyBoxModal ? "hidden-claim_FightPage" : ""
          }`}
          onClick={() => setShowDailyBoxModal(true)}
        >
          <img src="LUTBOX.png" alt="box" />

          {dailyBoxLoaded && (canDailyBoxClaim || dailyBoxReward) && (
            <div className="claim-alert_FightPage claim-alert_FightPage--purple">
              !
            </div>
          )}
        </div>
        <div
          className={`claim-widget_FightPage claim-widget_FightPage--blue ${
            showDailyTasksModal ? "hidden-claim_FightPage" : ""
          }`}
          onClick={() => setShowDailyTasksModal(true)}
        >
          <img src="/pngegg.png" alt="tasks" />
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
        {showDailyBoxModal && (
          <div
            className="claim-overlay_FightPage"
            onClick={() => {
              setShowDailyBoxModal(false);
              setSelectedDailyBox(null);
            }}
          >
            <div
              className="claim-window_FightPage"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="claim-title_FightPage">Ежедневный бонус</h3>

              {dailyBoxReward ? (
                <>
                  <div className="claim-reward_FightPage">
                    <CachedImage
                      src={dailyBoxReward.image_url}
                      alt={dailyBoxReward.name || "Лутбокс"}
                      className="claim-coin_FightPage"
                    />
                    <span className="claim-amount_FightPage">
                      {dailyBoxReward.name || "Лутбокс"}
                    </span>
                  </div>
                  <button
                    className="claim-button_FightPage"
                    onClick={() => navigate(`/shop?start=${uid}`)}
                  >
                    Открыть в магазине
                  </button>
                </>
              ) : (
                <>
                  {dailyBoxesLoading && <div>Загрузка...</div>}
                  {!dailyBoxesLoading && dailyBoxes.length === 0 && (
                    <div>Нет доступных боксов</div>
                  )}
                  {!dailyBoxesLoading &&
                    dailyBoxes.map((box) => (
                      <div
                        key={box.id}
                        className={`claim-reward_FightPage selectable_FightPage ${
                          selectedDailyBox?.id === box.id
                            ? "selected_FightPage"
                            : ""
                        }`}
                        onClick={() => setSelectedDailyBox(box)}
                      >
                        <CachedImage
                          src={box.image_url}
                          alt={box.name || "Лутбокс"}
                          className="claim-coin_FightPage"
                        />
                        <span className="claim-amount_FightPage">
                          {box.name || "Лутбокс"}
                        </span>
                      </div>
                    ))}

                  {canDailyBoxClaim && (
                    <button
                      disabled={!selectedDailyBox}
                      className="claim-button_FightPage"
                      onClick={handleDailyBoxClaim}
                    >
                      Забрать
                    </button>
                  )}

                  {!canDailyBoxClaim && (
                    <div className="claim-timer_FightPage">
                      Доступно через:{" "}
                      <span className="claim-timer-value_FightPage">
                        {Math.floor(dailyBoxRemaining / 3600)}:
                        {Math.floor((dailyBoxRemaining % 3600) / 60)
                          .toString()
                          .padStart(2, "0")}
                        :{(dailyBoxRemaining % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {showDailyTasksModal && (
          <div
            className="claim-overlay_FightPage"
            onClick={() => setShowDailyTasksModal(false)}
          >
            <div
              className="claim-window_FightPage daily-tasks-window_FightPage"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="claim-title_FightPage">Ежедневные задания</h3>
              <p className="daily-tasks-subtitle_FightPage">
                Выполни все задания за несколько минут и собери награды.
              </p>
              <div className="daily-tasks-list_FightPage">
                {dailyTasks.map((task) => {
                  const state = dailyTaskState?.[task.id];
                  const isCompleted = state?.completed;
                  const isClaimed = state?.claimed;

                  return (
                    <div key={task.id} className="daily-task-card_FightPage">
                      <div className="daily-task-title_FightPage">
                        {task.title}
                      </div>
                      <div className="daily-task-desc_FightPage">
                        {task.description}
                      </div>
                      <div className="daily-task-reward_FightPage">
                        Награда: {task.rewardLabel}
                      </div>
                      <div className="daily-task-status_FightPage">
                        {isClaimed
                          ? "Награда получена"
                          : isCompleted
                            ? "Задание выполнено"
                            : "В процессе"}
                      </div>
                      {dailyTasksLoaded && (
                        <button
                          className="daily-task-claim-button_FightPage"
                          disabled={!isCompleted || isClaimed}
                          onClick={() => handleDailyTaskClaim(task)}
                        >
                          {isClaimed ? "Получено" : "Забрать награду"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                className="claim-button_FightPage"
                onClick={() => setShowDailyTasksModal(false)}
              >
                Понятно
              </button>
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
              {showInfoModal === "raid" && (
                <div className="boss-effect-info">
                  <h4>Эффекты босса</h4>
                  <table className="boss-effect-table">
                    <thead>
                      <tr>
                        <th>Эффект</th>
                        <th>Что делает</th>
                        <th>Как применять</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Множитель урона</td>
                        <td>Применяется к обычному урону и DoT.</td>
                        <td>
                          Суммируется из бонусов карт и действует несколько
                          ходов.
                        </td>
                      </tr>
                      <tr>
                        <td>Поэтапный урон (DoT)</td>
                        <td>Наносит урон несколько ходов подряд.</td>
                        <td>Каждый тик усиливается текущим множителем урона.</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="boss-effect-note">
                    На странице босса отображается краткое название активного
                    эффекта и его действие.
                  </p>
                </div>
              )}
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
                  <CachedImage
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

                {raidEvent && (
                  <div className="raid-event-banner">
                    <div className="raid-event-title">{raidEvent.title}</div>
                    <div className="raid-event-desc">
                      {raidEvent.description}
                    </div>
                    <div className="raid-event-timer">
                      Смена через {formatRaidCountdown(eventCountdown)}
                    </div>
                  </div>
                )}

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

                      await completeDailyTask(
                        database,
                        uid,
                        dailyTaskIds,
                        "daily_raid"
                      );

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
