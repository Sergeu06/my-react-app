import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ref, get, onValue, off, set } from "firebase/database";
import { db } from "../firebase"; // Firestore
import { doc, getDoc } from "firebase/firestore"; // для getDoc и doc
import { database } from "../firebase";

import initGame from "../game-logic/initGame";
import playCardLogic from "../game-logic/playCard";
import endTurn from "../game-logic/endTurn";
import drawCards from "../game-logic/drawCards";

import HPBar from "./HPBar";
import PlayerInfo from "./PlayerInfo";
import TurnControls from "./TurnControls";
import PlayedCards from "./PlayedCards";
import OpponentHand from "./OpponentHand";
// 👇 добавляем
import FramedCard from "../../utils/FramedCard";
import { renderCardStats } from "../../utils/renderCardStats";

import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import "./game.css";
import "./playerhand.css";
function GamePage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("start");
  const lobbyId = searchParams.get("lobby");
  const timerInterval = useRef(null);

  const [isHost, setIsHost] = useState(false);
  const [firstTimerStarted, setFirstTimerStarted] = useState(false);

  const [gameData, setGameData] = useState(null);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [playedCards, setPlayedCards] = useState([]);
  const [recipes, setRecipes] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState(null);

  const [turnEnded, setTurnEnded] = useState(false);
  const [opponentTurnEnded, setOpponentTurnEnded] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const [timer, setTimer] = useState(30);
  const [autoEndTriggered, setAutoEndTriggered] = useState(false);

  useEffect(() => {
    async function fetchDeckAndHand() {
      try {
        // берём документ пользователя
        const userDoc = await getDoc(doc(db, "users", uid));
        if (!userDoc.exists()) {
          console.warn(`[GamePage] User ${uid} not found`);
          return;
        }

        const userData = userDoc.data();
        const playerDeck = userData.deck_pvp || []; // 👉 берём массив deck_pvp
        console.log("[GamePage] deck_pvp:", playerDeck);

        if (!Array.isArray(playerDeck) || playerDeck.length === 0) {
          console.warn("[GamePage] deck_pvp пустой");
          return;
        }

        // перемешиваем
        const shuffled = [...playerDeck].sort(() => 0.5 - Math.random());

        // тянем данные карт из RTDB
        const cardPromises = shuffled.map(async (cardId) => {
          const snapshot = await get(ref(database, `cards/${cardId}`));
          if (!snapshot.exists()) {
            console.warn(`[GamePage] card ${cardId} not found in RTDB`);
            return null;
          }
          return { id: cardId, ...snapshot.val() };
        });

        const cards = (await Promise.all(cardPromises)).filter(Boolean);

        console.log("[GamePage] loaded cards:", cards);

        setHand(cards.slice(0, 4));
        setDeck(cards.slice(4));
      } catch (err) {
        console.error("[GamePage] fetchDeckAndHand error:", err);
      }
    }

    if (uid) fetchDeckAndHand();
  }, [uid]);

  // загрузка данных лобби и определение хоста
  useEffect(() => {
    if (!uid || !lobbyId) return;
    console.log("[GamePage] loadGame()", { uid, lobbyId });

    const loadGame = async () => {
      try {
        const lobbySnap = await get(ref(database, `lobbies/${lobbyId}`));
        const lobbyData = lobbySnap.val();
        console.log("[GamePage] lobby data:", lobbyData);
        if (!lobbyData?.players) return;

        // определяем хоста
        if (lobbyData.players[0] === uid) {
          setIsHost(true);
          console.log("[GamePage] You are HOST");
        } else {
          setIsHost(false);
          console.log("[GamePage] You are GUEST");
        }

        const opponentUid = lobbyData.players.find((p) => p !== uid);
        const game = await initGame(uid, opponentUid, lobbyId);

        const playerData = game.players[uid];
        const opponentData = game.players[opponentUid];

        setGameData({
          player: playerData,
          opponent: opponentData,
          opponentUid,
        });
        setHand(playerData.hand);
        setDeck(playerData.deck);
        setRecipes(playerData.recipes || 0);
      } catch (e) {
        console.error("[GamePage] loadGame error:", e);
      }
    };

    loadGame();
  }, [uid, lobbyId]);

  // подписка на завершение хода соперника
  useEffect(() => {
    if (!lobbyId || !gameData?.opponentUid) return;

    const opponentTurnRef = ref(
      database,
      `lobbies/${lobbyId}/turns/${gameData.opponentUid}`
    );
    const listener = onValue(opponentTurnRef, (snapshot) => {
      const val = snapshot.val();
      console.log("[GamePage] opponent turn state changed:", val);
      setOpponentTurnEnded(val === true);
    });

    return () => {
      off(opponentTurnRef, "value", listener);
    };
  }, [lobbyId, gameData?.opponentUid]);

  // синхронизированный таймер
  useEffect(() => {
    if (!lobbyId) return;

    const timerRef = ref(database, `lobbies/${lobbyId}/turnTimerStart`);
    const unsub = onValue(timerRef, (snap) => {
      const val = snap.val();
      if (!val) return;

      const { start, duration } = val;
      console.log("[Timer] received start:", val);

      if (timerInterval.current) clearInterval(timerInterval.current);

      timerInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const remaining = duration - elapsed;
        if (remaining <= 0) {
          clearInterval(timerInterval.current);
          setTimer(0);
          if (!turnEnded) {
            console.log("[Timer] auto end turn (time up)");
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
  }, [lobbyId, turnEnded]);

  // --- функция старта таймера ---
  const startNewTurnTimer = async (duration = 30) => {
    if (!isHost) return; // только хост пишет
    if (!lobbyId) return;

    const timerRef = ref(database, `lobbies/${lobbyId}/turnTimerStart`);
    await set(timerRef, { start: Date.now(), duration });
    console.log(
      `[Timer] host set new turnTimerStart with duration ${duration}`
    );
  };

  // --- запуск первого таймера при заходе ---
  useEffect(() => {
    if (!uid || !lobbyId || !isHost || firstTimerStarted) return;

    console.log("[Timer] first round, set 40 sec timer");
    startNewTurnTimer(40);
    setFirstTimerStarted(true);
  }, [uid, lobbyId, isHost, firstTimerStarted]);
  // оба закончили — начинаем новый раунд
  useEffect(() => {
    if (turnEnded && opponentTurnEnded) {
      console.log("[GamePage] both turns ended -> resolving phase");

      // 3-секундная пауза для анимаций
      setWaitingForOpponent(true); // временно показываем «разыгровка»

      setTimeout(() => {
        console.log("[GamePage] resolving finished -> next round");

        const { newHand, newDeck } = drawCards(hand, deck);
        setHand(newHand);
        setDeck(newDeck);

        setTurnEnded(false);
        setOpponentTurnEnded(false);
        setWaitingForOpponent(false);
        setAutoEndTriggered(false);

        // очистка статусов в RTDB
        if (uid && gameData?.opponentUid && lobbyId) {
          const p1Ref = ref(database, `lobbies/${lobbyId}/turns/${uid}`);
          const p2Ref = ref(
            database,
            `lobbies/${lobbyId}/turns/${gameData.opponentUid}`
          );
          set(p1Ref, null);
          set(p2Ref, null);
          console.log("[GamePage] cleared turn statuses");
        }

        // новый таймер
        startNewTurnTimer();
      }, 3000);
    }
  }, [turnEnded, opponentTurnEnded, hand, deck]);

  const handlePlayCard = () => {
    const cardToPlay = hand.find((c) => c.id === selectedCardId);
    if (!cardToPlay) return;
    try {
      const {
        hand: newHand,
        playedCards: newPlayed,
        recipes: newRecipes,
      } = playCardLogic({ hand, playedCards, recipes, cardToPlay });
      setHand(newHand);
      setPlayedCards(newPlayed);
      setRecipes(newRecipes);
      setSelectedCardId(null);
    } catch (err) {
      console.warn("[GamePage] play card failed:", err);
      alert(err.message);
    }
  };

  const handleUndoCard = (card) => {
    setHand((prev) => [...prev, card]);
    setPlayedCards((prev) => prev.filter((c) => c.id !== card.id));
    setRecipes((prev) => prev + (card.cost || 0));
  };

  const handleEndTurn = async () => {
    console.log("[GamePage] end turn clicked");
    try {
      await endTurn(uid, lobbyId);
      setTurnEnded(true);
      if (!opponentTurnEnded) {
        setWaitingForOpponent(true);
      }
    } catch (e) {
      console.error("[GamePage] end turn error:", e);
    }
  };

  if (!gameData) return <div>Загрузка...</div>;

  return (
    <div className="game-container">
      <TurnControls
        timer={timer}
        turnEnded={turnEnded}
        onEndTurn={handleEndTurn}
      />

      <OpponentHand count={gameData.opponent.deck.length || 0} />
      <PlayerInfo
        avatarUrl={gameData.opponent.avatar_url}
        nickname={gameData.opponent.nickname}
        lvl={gameData.opponent.lvl}
        position="top"
      />
      <HPBar
        hp={gameData.opponent.hp}
        maxHp={gameData.opponent.maxHp}
        position="top"
        style={{ position: "absolute", top: "1%", left: "3%" }}
      />
      <PlayerInfo
        avatarUrl={gameData.player.avatar_url}
        nickname={gameData.player.nickname}
        lvl={gameData.player.lvl}
        position="bottom"
      />
      <HPBar
        hp={gameData.player.hp}
        maxHp={gameData.player.maxHp}
        position="bottom"
        style={{ position: "absolute", bottom: "18vh", left: "3%" }}
      />
      <PlayedCards cards={playedCards} onUndo={handleUndoCard} />
      {waitingForOpponent && (
        <div className="waiting-message">Ждём соперника...</div>
      )}
      <div className="recipes-container">
        <AutoAwesomeIcon fontSize="small" style={{ marginRight: 6 }} />
        {recipes}
      </div>
      <div className="player-bottom-bar">
        <div
          className="player-hand-platform"
          onClick={() => setSelectedCardId(null)}
          tabIndex={-1}
        >
          <div className="player-hand">
            {hand.map((card) => {
              const isSelected = selectedCardId === card.id;
              return (
                <div
                  key={card.id}
                  className={`card-in-hand-wrapper${
                    isSelected ? " selected" : ""
                  }`}
                  title={card.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCardId(isSelected ? null : card.id);
                  }}
                >
                  <FramedCard card={card} showLevel={true} showName={false} />

                  {card.value !== undefined && (
                    <div className="card-corner cost">{card.value}</div>
                  )}

                  {renderCardStats(card).map((stat, index) => (
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
                  ))}

                  {/* 👇 кнопка теперь рендерится только у выбранной карты */}
                  {isSelected && (
                    <button
                      className="playcardbutton"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log(
                          "[UI] Кнопка 'Разыграть' нажата (заглушка)"
                        );
                        // здесь позже вызовем handlePlayCard()
                      }}
                    >
                      Разыграть
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GamePage;
