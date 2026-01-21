import React, { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  databaseRef,
  get,
  onValue,
  off,
  set,
  db,
  doc,
  getDoc,
  database,
} from "../firebase"; // Firestore
import { motion, AnimatePresence } from "framer-motion";
import { addEnergy, spendEnergy } from "../game-logic/energyManager";
import initGame from "../game-logic/initGame";
import endTurn from "../game-logic/endTurn";

import HPBar from "./HPBar";
import PlayerInfo from "./PlayerInfo";
import TurnControls from "./TurnControls";
import PlayedCards from "./PlayedCards";
import OpponentHand from "./OpponentHand";

// 👇 добавляем
import FramedCard from "../../utils/FramedCard";
import { renderCardStats } from "../../utils/renderCardStats";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useDrag, useDragLayer, useDrop } from "react-dnd";
import useResolvingPhase from "../game-logic/useResolvingPhase";
import useLobbyPresence from "../game-logic/useLobbyPresence";
import { usePerformance } from "../../perf/PerformanceContext";
import { usePageActivity } from "../../perf/usePageActivity";
import { debugLog } from "../../perf/debugLog";

import "./game.css";
import "./animations.css";
import "./playerhand.css";

const DRAG_CARD_TYPE = "PVP_HAND_CARD";

const sortPlayedCards = (cards = []) =>
  [...cards].sort((a, b) => {
    const aTs = Number(a.ts ?? 0);
    const bTs = Number(b.ts ?? 0);
    if (aTs !== bTs) return aTs - bTs;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });

function DraggableHandCard({
  card,
  index,
  isSelected,
  canPlay,
  isOverPlayerBoard,
  onPlayCard,
  onSelect,
  renderStats,
  moveCard,
}) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: DRAG_CARD_TYPE,
      item: () => {
        debugLog("[DnD] drag start", { cardId: card.id, canPlay });
        return {
          cardId: card.id,
          cost: card.cost ?? card.value ?? 0,
          card,
          index,
        };
      },
      canDrag: true,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      end: (item, monitor) => {
        debugLog("[DnD] drag end", {
          cardId: item?.cardId,
          didDrop: monitor.didDrop(),
        });
        if (monitor.didDrop()) return;
        if (!canPlay || !item?.cardId) return;
        const clientOffset = monitor.getClientOffset();
        if (!isOverPlayerBoard?.(clientOffset)) return;
        debugLog("[DnD] drop fallback: play from drag end", {
          cardId: item.cardId,
          source: "drag-fallback",
        });
        onPlayCard?.(item.cardId, "drag-fallback");
      },
    }),
    [card.id, canPlay, isOverPlayerBoard, onPlayCard]
  );
  const [, dropRef] = useDrop(
    () => ({
      accept: DRAG_CARD_TYPE,
      hover: (item) => {
        if (!item?.cardId || item.cardId === card.id) return;
        if (item.index === undefined) return;
        if (item.index === index) return;
        moveCard(item.index, index);
        item.index = index;
      },
    }),
    [card.id, index, moveCard]
  );
  const setCardRef = (node) => {
    dragRef(node);
    dropRef(node);
  };

  useEffect(() => {
    if (!isDragging) return;
    debugLog("[DnD] dragging", { cardId: card.id });
  }, [isDragging, card.id]);

  return (
    <div
      ref={setCardRef}
      className={`card-in-hand-wrapper${isSelected ? " selected" : ""}`}
      title={card.name}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(isSelected ? null : card.id);
      }}
      style={{ opacity: isDragging ? 0.6 : 1 }}
    >
      <FramedCard
        card={card}
        showLevel={true}
        showName={false}
        showPriority={true}
      />

      {card.value !== undefined && (
        <div className="card-corner cost">{card.value}</div>
      )}

      {renderStats(card)}
    </div>
  );
}

function DragPreviewLayer({ card, offset, canPlay, renderStats }) {
  if (!card || !offset) return null;

  return (
    <div className="drag-layer">
      <div
        className="drag-layer-inner"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div
          className={`drag-preview ${
            canPlay ? "drag-preview-allowed" : "drag-preview-blocked"
          }`}
        >
          <div className="drag-preview-card">
            <FramedCard
              card={card}
              showLevel={true}
              showName={false}
              showPriority={true}
            />
            {card.value !== undefined && (
              <div className="card-corner cost">{card.value}</div>
            )}
            {renderStats(card)}
          </div>
        </div>
      </div>
    </div>
  );
}

const formatMultiplierValue = (value) => {
  if (!isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, "");
};

function GamePage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("start");
  const lobbyId = searchParams.get("lobby");
  const timerInterval = useRef(null);
  const [canUndo, setCanUndo] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [firstTimerStarted, setFirstTimerStarted] = useState(false);
  const [opponentPlayed, setOpponentPlayed] = useState([]);
  const [showRound, setShowRound] = useState(false);

  const [gameData, setGameData] = useState(null);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [playedCards, setPlayedCards] = useState([]);
  const [recipes, setRecipes] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [round, setRound] = useState(1);
  const [showDamageFlash, setShowDamageFlash] = useState(false);
  const [turnEnded, setTurnEnded] = useState(false);
  const [opponentTurnEnded, setOpponentTurnEnded] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [priorityUid, setPriorityUid] = useState(null);
  const [handVisible, setHandVisible] = useState(true);
  const navigate = useNavigate();
  const { isTransitioning } = usePerformance();
  const isActive = usePageActivity({ isTransitioning });

  const [timer, setTimer] = useState(30);
  const [autoEndTriggered, setAutoEndTriggered] = useState(false);

  const [processedCardIds, setProcessedCardIds] = useState(new Set());
  const [roundPhase, setRoundPhase] = useState("play");

  const [effectsByUid, setEffectsByUid] = useState({});
  const playerBoardRef = useRef(null);
  // --- функция старта таймера ---
  const startNewTurnTimer = async (duration = 25) => {
    if (!isHost) return; // только хост пишет
    if (!lobbyId) return;

    const timerRef = databaseRef(
      database,
      `lobbies/${lobbyId}/turnTimerStart`
    );
    await set(timerRef, { start: Date.now(), duration });
    debugLog(
      `[Таймер] хост установил новый таймер хода с длительностью ${duration}`
    );
  };

  useResolvingPhase({
    uid,
    lobbyId,
    isHost,
    turnEnded,
    opponentTurnEnded,
    playedCards,
    opponentPlayed,
    priorityUid,
    effectsByUid,
    setEffectsByUid,
    setProcessedCardIds,
    processedCardIds,
    setRoundPhase,
    setWaitingForOpponent,
    setTurnEnded,
    setOpponentTurnEnded,
    setAutoEndTriggered,
    setPlayedCards,
    setOpponentPlayed,
    hand,
    setHand,
    deck,
    setDeck,
    gameData,
    startNewTurnTimer,
    database,
    setShowRound,
    setShowDamageFlash,
    setHandVisible,
    navigate,
    setCanUndo,
  });

  useLobbyPresence({
    database,
    lobbyId,
    uid,
    opponentUid: gameData?.opponentUid,
  });

  // Подписка на завершение игры
  useEffect(() => {
    if (!lobbyId || !isActive) return;

    const statusRef = databaseRef(database, `lobbies/${lobbyId}/status`);
    const unsub = onValue(statusRef, (snap) => {
      const val = snap.val();
      debugLog("[GamePage] статус лобби:", val);
      if (val === "end") {
        // подгружаем данные победителя/проигравшего
        get(databaseRef(database, `lobbies/${lobbyId}`)).then((snap) => {
          if (snap.exists()) {
            const lobby = snap.val();
            const { winner, loser } = lobby;
            navigate(
              `/result?lobby=${lobbyId}&winner=${winner}&loser=${loser}&start=${uid}`
            );
          }
        });
      }
    });

    return () => off(statusRef);
  }, [isActive, lobbyId, navigate]);

  useEffect(() => {
    if (!lobbyId || !uid || !isActive) return;
    const energyRef = databaseRef(database, `lobbies/${lobbyId}/energy/${uid}`);
    const unsub = onValue(energyRef, (snap) => {
      const val = snap.val();
      if (val !== null) setRecipes(val); // синхронизация локального отображения
    });
    return () => off(energyRef);
  }, [isActive, lobbyId, uid]);
  useEffect(() => {
    if (!lobbyId || !uid || !gameData?.opponentUid || !isActive) return;

    const playerHpRef = databaseRef(database, `lobbies/${lobbyId}/hp/${uid}`);
    const opponentHpRef = databaseRef(
      database,
      `lobbies/${lobbyId}/hp/${gameData.opponentUid}`
    );

    const unsubPlayer = onValue(playerHpRef, (snap) => {
      const hp = snap.val();
      if (hp !== null) {
        setGameData((prev) => ({
          ...prev,
          player: { ...prev.player, hp },
        }));
      }
    });

    const unsubOpponent = onValue(opponentHpRef, (snap) => {
      const hp = snap.val();
      if (hp !== null) {
        setGameData((prev) => ({
          ...prev,
          opponent: { ...prev.opponent, hp },
        }));
      }
    });

    return () => {
      off(playerHpRef);
      off(opponentHpRef);
    };
  }, [isActive, lobbyId, uid, gameData?.opponentUid]);

  useEffect(() => {
    if (!lobbyId || !uid || !gameData?.opponentUid || !isActive) return;

    const playerMaxHpRef = databaseRef(database, `lobbies/${lobbyId}/maxHp/${uid}`);
    const opponentMaxHpRef = databaseRef(
      database,
      `lobbies/${lobbyId}/maxHp/${gameData.opponentUid}`
    );

    const unsubPlayerMax = onValue(playerMaxHpRef, (snap) => {
      const maxHp = snap.val();
      if (maxHp !== null) {
        setGameData((prev) => ({
          ...prev,
          player: { ...prev.player, maxHp },
        }));
      }
    });

    const unsubOpponentMax = onValue(opponentMaxHpRef, (snap) => {
      const maxHp = snap.val();
      if (maxHp !== null) {
        setGameData((prev) => ({
          ...prev,
          opponent: { ...prev.opponent, maxHp },
        }));
      }
    });

    return () => {
      unsubPlayerMax();
      unsubOpponentMax();
    };
  }, [isActive, lobbyId, uid, gameData?.opponentUid]);

  useEffect(() => {
    if (!lobbyId || !uid || !gameData?.opponentUid || !isActive) return;

    const uids = [uid, gameData.opponentUid];

    const dotRefs = [];
    const multRefs = [];

    uids.forEach((who) => {
      const dotRef = databaseRef(database, `lobbies/${lobbyId}/effects/${who}/dot`);
      const multRef = databaseRef(
        database,
        `lobbies/${lobbyId}/effects/${who}/multiplier`
      );

      dotRefs.push(dotRef);
      multRefs.push(multRef);

      onValue(dotRef, (snap) => {
        const dot = snap.val() || [];
        setEffectsByUid((prev) => ({
          ...prev,
          [who]: { ...(prev[who] || {}), dot },
        }));
      });

      onValue(multRef, (snap) => {
        const mult = snap.val() ?? null;
        setEffectsByUid((prev) => ({
          ...prev,
          [who]: { ...(prev[who] || {}), mult },
        }));
      });
    });

    return () => {
      dotRefs.forEach((r) => off(r));
      multRefs.forEach((r) => off(r));
    };
  }, [isActive, lobbyId, uid, gameData?.opponentUid]);

  useEffect(() => {
    if (!lobbyId || !isActive) return;

    const priorityRef = databaseRef(database, `lobbies/${lobbyId}/priority`);
    const unsub = onValue(priorityRef, (snap) => {
      const val = snap.val();
      debugLog("[DEBUG] priority from RTDB:", val); // <- добавь это
      setPriorityUid(val);
    });

    return () => off(priorityRef);
  }, [isActive, lobbyId]);
  useEffect(() => {
    if (!lobbyId || !isActive) return;

    const roundRef = databaseRef(database, `lobbies/${lobbyId}/round`);
    const unsub = onValue(roundRef, (snap) => {
      const val = snap.val();
      if (val) setRound(val);
    });

    return () => off(roundRef);
  }, [isActive, lobbyId]);
  useEffect(() => {
    const handleClickOutside = () => {
      setSelectedCardId(null);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  useEffect(() => {
    async function fetchDeckAndHand() {
      try {
        // берём документ пользователя
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) {
          console.warn(`[GamePage] Пользователь ${uid} не найден`);
          return;
        }

        const userData = userDoc.data();
        const playerDeck = userData.deck_pvp || []; // 👉 берём массив deck_pvp
        debugLog("[GamePage] deck_pvp:", playerDeck);

        if (!Array.isArray(playerDeck) || playerDeck.length === 0) {
          console.warn("[GamePage] deck_pvp пустой");
          return;
        }

        // перемешиваем
        const shuffled = [...playerDeck].sort(() => 0.5 - Math.random());

        // тянем данные карт из RTDB
        const cardPromises = shuffled.map(async (cardId) => {
          const snapshot = await get(databaseRef(database, `cards/${cardId}`));
          if (!snapshot.exists()) {
            console.warn(`[GamePage] карта ${cardId} не найдена в RTDB`);
            return null;
          }
          return { id: cardId, ...snapshot.val() };
        });

        const cards = (await Promise.all(cardPromises)).filter(Boolean);

        debugLog("[GamePage] загруженные карты:", cards);

        setHand(cards.slice(0, 4));
        setDeck(cards.slice(4));
      } catch (err) {
        console.error("[GamePage] fetchDeckAndHand error:", err);
      }
    }

    let rafId = null;
    if (uid && isActive) {
      rafId = requestAnimationFrame(() => {
        fetchDeckAndHand();
      });
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isActive, uid]);

  // загрузка данных лобби и определение хоста
  useEffect(() => {
    if (!uid || !lobbyId || !isActive) return;
    debugLog("[GamePage] загрузка игры()", { uid, lobbyId });

    const loadGame = async () => {
      try {
        const lobbySnap = await get(databaseRef(database, `lobbies/${lobbyId}`));
        const lobbyData = lobbySnap.val();
        if (!lobbyData?.players) return;

        // определяем хоста
        if (lobbyData.players[0] === uid) {
          setIsHost(true);
        } else {
          setIsHost(false);
        }

        const opponentUid = lobbyData.players.find((p) => p !== uid);
        const game = await initGame(uid, opponentUid, lobbyId);

        const playerData = game.players[uid];
        const opponentData = game.players[opponentUid];

        // ✅ вот сюда вставляем запись HP в RTDB
        await Promise.all([
          set(databaseRef(database, `lobbies/${lobbyId}/hp/${uid}`), playerData.hp),
          set(
            databaseRef(database, `lobbies/${lobbyId}/maxHp/${uid}`),
            playerData.maxHp
          ),
          set(
            databaseRef(database, `lobbies/${lobbyId}/hp/${opponentUid}`),
            opponentData.hp
          ),
          set(
            databaseRef(database, `lobbies/${lobbyId}/maxHp/${opponentUid}`),
            opponentData.maxHp
          ),
        ]);

        setGameData({
          player: playerData,
          opponent: opponentData,
          opponentUid,
        });
        if (isHost) {
          await startFirstRound();
        }
        await set(
          databaseRef(database, `lobbies/${lobbyId}/recipes/${uid}`),
          playerData.recipes || 0
        );
        setRecipes(playerData.recipes || 0);
        debugLog(
          `%c[GamePage] Хост: ${lobbyData.players[0]}, Гость: ${lobbyData.players[1]}`,
          "color: deepskyblue; font-weight: bold"
        );
      } catch (e) {
        console.error("[GamePage] ошибка при загрузке игры:", e);
      }
    };

    const rafId = requestAnimationFrame(() => {
      loadGame();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isActive, uid, lobbyId]);
  // подписка на завершение хода соперника
  useEffect(() => {
    if (!lobbyId || !gameData?.opponentUid || !isActive) return;

    const oppTurnRef = databaseRef(
      database,
      `lobbies/${lobbyId}/turns/${gameData.opponentUid}`
    );

    const unsub = onValue(oppTurnRef, (snap) => {
      const val = snap.val();
      debugLog("[GamePage] ход соперника завершён:", val);
      setOpponentTurnEnded(!!val); // true, если соперник завершил
    });

    return () => off(oppTurnRef);
  }, [isActive, lobbyId, gameData?.opponentUid]);

  // подписка на завершение хода соперника
  useEffect(() => {
    if (!lobbyId || !gameData?.opponentUid || !isActive) return;

    const oppPlayedRef = databaseRef(
      database,
      `lobbies/${lobbyId}/playedCards/${gameData.opponentUid}`
    );
    const unsub = onValue(oppPlayedRef, (snap) => {
      const val = snap.val();
      if (!val) {
        debugLog("[GamePage] сыгранные карты соперника очищены");

        setOpponentPlayed([]); // 👈 сбрасываем руку соперника
      } else {
        const cards = sortPlayedCards(Object.values(val));
        debugLog("[GamePage] сыгранные карты соперника:", cards);
        setOpponentPlayed(cards);
      }
    });

    return () => off(oppPlayedRef);
  }, [isActive, lobbyId, gameData?.opponentUid]);

  // синхронизированный таймер
  useEffect(() => {
    if (!lobbyId || !isActive) return;

    const timerRef = databaseRef(database, `lobbies/${lobbyId}/turnTimerStart`);
    const unsub = onValue(timerRef, (snap) => {
      const val = snap.val();
      if (!val) return;

      const { start, duration } = val;
      debugLog("[Таймер] получен старт таймера:", val);

      if (timerInterval.current) clearInterval(timerInterval.current);

      timerInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const remaining = duration - elapsed;
        if (remaining <= 0) {
          clearInterval(timerInterval.current);
          setTimer(0);
          if (!turnEnded) {
            debugLog(
              "[Таймер] автоматическое завершение хода (время вышло)"
            );
            handleEndTurn();
          }
        } else {
          setTimer(remaining);
        }
      }, 1000);
    });

    return () => {
      off(timerRef);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [isActive, lobbyId, turnEnded]);

  useEffect(() => {
    if (!lobbyId || !isActive) return;

    const doneRef = databaseRef(database, `lobbies/${lobbyId}/resolvingDone`);
    const unsub = onValue(doneRef, (snap) => {
      if (snap.exists()) {
        debugLog("[GamePage] resolvingDone received, reset flags only");

        // ⬇️ мы УЖЕ управляем фазами в useResolvingPhase
        setWaitingForOpponent(false);
        setTurnEnded(false);
        setOpponentTurnEnded(false);
        setAutoEndTriggered(false);
        setProcessedCardIds(new Set());
      }
    });

    return () => off(doneRef);
  }, [isActive, lobbyId]);

  // --- запуск первого таймера при заходе ---
  useEffect(() => {
    if (!uid || !lobbyId || !isHost || firstTimerStarted || !isActive) return;

    debugLog("[Timer] first round, set 40 sec timer");
    startNewTurnTimer(25);
    setFirstTimerStarted(true);
  }, [isActive, uid, lobbyId, isHost, firstTimerStarted]);
  // 👇 ставим где-то после всех useState, до return
  useEffect(() => {
    debugLog(
      `[Hand Debug] Текущее количество карт в руке: ${hand.length}, в колоде: ${deck.length}`
    );
    debugLog(
      "[Hand Debug] Состав руки:",
      hand.map((c) => c.id)
    );
  }, [hand, deck]);

  const isOverPlayerBoard = useCallback((point) => {
    if (!point) return false;
    const rect = playerBoardRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom
    );
  }, []);

  const handlePlayCard = async (cardId = selectedCardId, source = "drag") => {
    const cardToPlay = hand.find((c) => c.id === cardId);
    if (!cardToPlay) {
      debugLog("[DnD] play aborted: card not found", { cardId, source });
      return;
    }
    if (turnEnded || roundPhase !== "play") {
      debugLog("[DnD] play blocked: phase/turn", {
        cardId,
        source,
        turnEnded,
        roundPhase,
      });
      return;
    }

    const cost = Number(cardToPlay.cost ?? cardToPlay.value ?? 0);

    // Попытка списания энергии через energyManager
    const spent = await spendEnergy(database, lobbyId, uid, cost);
    if (!spent) {
      debugLog("[DnD] play blocked: insufficient energy", { cardId, source });
      alert("Недостаточно энергии!");
      return;
    }

    // Убираем карту из руки и добавляем в сыгранные
    setHand((prev) => prev.filter((c) => c.id !== cardToPlay.id));
    setSelectedCardId(null);
    const cardWithTs = {
      ...cardToPlay,
      ts: Date.now(),
      playedInRound: round, // 👈 КРИТИЧНО
    };
    setPlayedCards((prev) => [...prev, cardWithTs]);

    // RTDB сыгранные карты
    const playedRef = databaseRef(
      database,
      `lobbies/${lobbyId}/playedCards/${uid}/${cardToPlay.id}`
    );
    await set(playedRef, cardWithTs);

    setSelectedCardId(null);

    debugLog(`[GamePage][Energy] Карта сыграна: ${cardToPlay.id}, -${cost}`);
    debugLog("[DnD] play success", { cardId: cardToPlay.id, source });
  };

  const canDropCard = useCallback(
    (item) => {
      if (!item?.cardId) return false;
      if (turnEnded || roundPhase !== "play") return false;
      const cardCost = Number(item.cost ?? 0);
      if (!Number.isFinite(cardCost)) return false;
      const availableEnergy = Number(recipes ?? 0);
      return availableEnergy >= cardCost;
    },
    [recipes, roundPhase, turnEnded]
  );

  const [{ isOverBoard, canDropOnBoard }, boardDropRef] = useDrop(
    () => ({
      accept: DRAG_CARD_TYPE,
      canDrop: (item) => canDropCard(item),
      drop: (item) => {
        debugLog("[DnD] drop received", { item });
        if (item?.cardId) {
          handlePlayCard(item.cardId, "drop");
        }
      },
      collect: (monitor) => ({
        isOverBoard: monitor.isOver(),
        canDropOnBoard: monitor.canDrop(),
      }),
    }),
    [canDropCard, handlePlayCard]
  );
  const setBoardRefs = useCallback(
    (node) => {
      boardDropRef(node);
      playerBoardRef.current = node;
    },
    [boardDropRef]
  );

  const dragLayerState = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    currentOffset: monitor.getClientOffset(),
  }));
  const draggedCard =
    dragLayerState.item?.card ??
    hand.find((card) => card.id === dragLayerState.item?.cardId);
  const draggedCardCost = Number(draggedCard?.cost ?? draggedCard?.value ?? 0);
  const canPlayDraggedCard = draggedCard
    ? !turnEnded &&
      roundPhase === "play" &&
      Number(recipes ?? 0) >= draggedCardCost
    : false;
  const dropState = dragLayerState.isDragging
    ? canDropOnBoard
      ? isOverBoard
        ? "allowed-over"
        : "allowed"
      : isOverBoard
        ? "blocked-over"
        : "blocked"
    : "idle";

  useEffect(() => {
    debugLog("[DnD] board state", {
      canDropOnBoard,
      isOverBoard,
      roundPhase,
      turnEnded,
    });
  }, [canDropOnBoard, isOverBoard, roundPhase, turnEnded]);

  const moveCard = useCallback((fromIndex, toIndex) => {
    setHand((prev) => {
      if (fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  }, []);

  const renderStats = (card) =>
    renderCardStats(card).map((stat, index) => (
      <div
        key={stat.label + index}
        className={`card-corner ${stat.type}`}
        style={{
          bottom: `${-12 + index * 22}px`,
          left: -12,
          fontSize: "1em",
        }}
      >
        {stat.value !== null ? stat.value : "×"}
      </div>
    ));
  const startFirstRound = async () => {
    if (!isHost || !lobbyId) return;

    const roundRef = databaseRef(database, `lobbies/${lobbyId}/round`);
    const priorityRef = databaseRef(database, `lobbies/${lobbyId}/priority`);

    await set(roundRef, 1);
    await set(priorityRef, gameData?.player ? uid : gameData?.opponentUid); // 👈 первый ход у хоста
    await startNewTurnTimer(25);
    setFirstTimerStarted(true);
  };

  const handleUndoCard = async (card) => {
    // Возвращаем карту в руку
    const restoredCard = { ...card };
    delete restoredCard.canUndo;
    delete restoredCard.playedInRound;

    setHand((prev) => [...prev, restoredCard]);
    setPlayedCards((prev) => prev.filter((c) => c.id !== card.id));

    const cost = card.cost ?? card.value ?? 0;

    // Восстановление энергии через energyManager
    await addEnergy(database, lobbyId, uid, cost);

    // Убираем карту из RTDB сыгранных
    const playedRef = databaseRef(
      database,
      `lobbies/${lobbyId}/playedCards/${uid}/${card.id}`
    );
    await set(playedRef, null);

    debugLog(`[GamePage][Energy] Карта отменена: ${card.id}, +${cost}`);
  };

  const handleEndTurn = async () => {
    debugLog("[GamePage] нажата кнопка 'Завершить ход'");

    try {
      await endTurn(uid, lobbyId);
      setTurnEnded(true);
      setPlayedCards((prev) =>
        prev.map((c) => ({
          ...c,
          locked: true, // 🔒 карта зафиксирована
        }))
      );

      if (!opponentTurnEnded) {
        setWaitingForOpponent(true);
      }
    } catch (e) {
      console.error("[GamePage] ошибка при завершении хода:", e);
    }
  };

  if (!gameData) return <div>Загрузка...</div>;

  const buildMultiplierLabel = (effect) => {
    if (!effect?.multiplier || !effect?.turnsLeft) return null;
    const formatted = formatMultiplierValue(effect.multiplier);
    if (!formatted) return null;
    return `x${formatted}-${effect.turnsLeft}`;
  };
  const playerMultiplierLabel = buildMultiplierLabel(effectsByUid[uid]?.mult);
  const opponentMultiplierLabel = buildMultiplierLabel(
    effectsByUid[gameData.opponentUid]?.mult
  );

  return (
    <div className="game-container">
      <TurnControls
        timer={timer}
        turnEnded={turnEnded}
        opponentTurnEnded={opponentTurnEnded}
        onEndTurn={handleEndTurn}
        roundPhase={roundPhase}
      />

      <OpponentHand
        count={gameData.opponent.hand.length}
        style={{
          position: "absolute",
          top: "6%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      <PlayerInfo
        avatarUrl={gameData.opponent.avatar_url}
        nickname={gameData.opponent.nickname}
        lvl={gameData.opponent.lvl}
        position="top"
        multiplierLabel={opponentMultiplierLabel}
      />
      <HPBar
        hp={gameData.opponent.hp}
        maxHp={gameData.opponent.maxHp}
        position="top"
        style={{ position: "absolute", top: "1%", left: "3%" }}
        hasPriority={priorityUid === gameData.opponentUid} // 👈
        multiplierLabel={opponentMultiplierLabel}
      />
      <PlayerInfo
        avatarUrl={gameData.player.avatar_url}
        nickname={gameData.player.nickname}
        lvl={gameData.player.lvl}
        position="bottom"
        multiplierLabel={playerMultiplierLabel}
      />
      <HPBar
        hp={gameData.player.hp}
        maxHp={gameData.player.maxHp}
        position="bottom"
        style={{ position: "absolute", bottom: "18vh", left: "3%" }}
        hasPriority={priorityUid === uid} // 👈
        multiplierLabel={playerMultiplierLabel}
      />

      {waitingForOpponent && roundPhase === "play" && (
        <div className="waiting-message">Ждём соперника...</div>
      )}

      <div className="board-center">
        {/* Верхняя половина — соперник */}
        <div className="board-half opponent">
          <PlayedCards
            cards={opponentPlayed}
            side="opponent"
            bothTurnsEnded={turnEnded && opponentTurnEnded}
          />{" "}
        </div>

        {/* Нижняя половина — игрок */}
        <div
          ref={setBoardRefs}
          className={`board-half player drop-target drop-target-${dropState}`}
          data-drop-state={dropState}
        >
          <PlayedCards
            cards={playedCards}
            side="player"
            onUndo={handleUndoCard}
            turnEnded={turnEnded}
            bothTurnsEnded={turnEnded && opponentTurnEnded}
            roundPhase={roundPhase}
          />
        </div>
        {/* Анимированный индикатор раунда */}
        <AnimatePresence>
          {showRound && (
            <motion.div
              className="round-indicator"
              key={round}
              initial={{ opacity: 0, scale: 0, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0, x: "-50%", y: "-50%" }}
              transition={{
                duration: 0.4,
                scale: { type: "spring", bounce: 0.3, damping: 5 },
              }}
            >
              Раунд {round}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {dragLayerState.isDragging && (
        <DragPreviewLayer
          card={draggedCard}
          offset={dragLayerState.currentOffset}
          canPlay={canPlayDraggedCard}
          renderStats={renderStats}
        />
      )}

      <div className="recipes-container">
        <AutoAwesomeIcon fontSize="small" style={{ marginRight: 6 }} />
        {recipes}
      </div>
      {showDamageFlash && (
        <div
          key={Date.now()} // важен ключ, чтобы React пересоздал элемент
          className="damage-flash"
        />
      )}

      <div
        className={`player-bottom-bar ${handVisible ? "" : "hidden"}${
          dragLayerState.isDragging ? " dragging" : ""
        }`}
      >
        <div
          className="player-hand-platform"
          onClick={() => setSelectedCardId(null)}
          tabIndex={-1}
        >
          <div className="player-hand">
            {hand.map((card, index) => {
              const isSelected = selectedCardId === card.id;
              const cost = card.cost ?? card.value ?? 0;
              const canPlay =
                !turnEnded && roundPhase === "play" && recipes >= cost;
              return (
                <DraggableHandCard
                  key={card.id}
                  card={card}
                  index={index}
                  isSelected={isSelected}
                  canPlay={canPlay}
                  isOverPlayerBoard={isOverPlayerBoard}
                  onPlayCard={handlePlayCard}
                  onSelect={setSelectedCardId}
                  renderStats={renderStats}
                  moveCard={moveCard}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GamePage;