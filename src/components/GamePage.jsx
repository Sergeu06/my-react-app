import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ref, get, onValue, off } from "firebase/database";
import { database } from "./firebase";
import initGame from "./game-logic/initGame";
import playCardLogic from "./game-logic/playCard";
import endTurn from "./game-logic/endTurn";
import drawCards from "./game-logic/drawCards"; // добор карт
import "./GamePage.css";

import FavoriteIcon from "@mui/icons-material/Favorite";
import SecurityIcon from "@mui/icons-material/Security";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

function GamePage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("start");
  const lobbyId = searchParams.get("lobby");

  const [gameData, setGameData] = useState(null);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [playedCards, setPlayedCards] = useState([]);
  const [recipes, setRecipes] = useState(0);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [turnEnded, setTurnEnded] = useState(false);
  const [opponentTurnEnded, setOpponentTurnEnded] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  const [timer, setTimer] = useState(30);
  const [autoEndTriggered, setAutoEndTriggered] = useState(false);

  // Загрузка игры
  useEffect(() => {
    if (!uid || !lobbyId) return;

    const loadGame = async () => {
      try {
        const lobbySnap = await get(ref(database, `lobbies/${lobbyId}`));
        const lobbyData = lobbySnap.val();

        if (!lobbyData?.players) throw new Error("Лобби не найдено");

        const opponentUid = lobbyData.players.find((p) => p !== uid);
        const game = await initGame(uid, opponentUid, lobbyId);

        const playerData = game.players[uid];
        const opponentData = game.players[opponentUid];

        setHand(playerData.hand);
        setDeck(playerData.deck);
        setRecipes(playerData.recipes || 0);
        setPlayedCards([]);
        setGameData({
          player: playerData,
          opponent: opponentData,
          opponentUid,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [uid, lobbyId]);

  // Слежение за завершением хода соперника
  useEffect(() => {
    if (!lobbyId || !gameData?.opponentUid) return;

    const opponentTurnRef = ref(
      database,
      `lobbies/${lobbyId}/turns/${gameData.opponentUid}`
    );
    const listener = onValue(opponentTurnRef, (snapshot) => {
      setOpponentTurnEnded(snapshot.val() === true);
    });

    return () => off(opponentTurnRef, "value", listener);
  }, [lobbyId, gameData?.opponentUid]);

  // Автоматическое завершение хода по таймеру
  useEffect(() => {
    if (turnEnded) return;

    if (timer <= 0 && !autoEndTriggered) {
      setAutoEndTriggered(true);
      handleEndTurn();
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer, turnEnded, autoEndTriggered]);

  // Обработка перехода к следующему ходу (добор карт после окончания обоих ходов)
  useEffect(() => {
    if (turnEnded && opponentTurnEnded) {
      const { newHand, newDeck } = drawCards(hand, deck);
      setHand(newHand);
      setDeck(newDeck);
      setTurnEnded(false);
      setOpponentTurnEnded(false);
      setWaitingForOpponent(false);
      setTimer(30);
      setAutoEndTriggered(false);
    }
  }, [turnEnded, opponentTurnEnded, hand, deck]);

  // Отмена сыгранной карты — возвращаем в руку и ресурсы
  const handleUndoCard = (card) => {
    setHand((prevHand) => [...prevHand, card]);
    setPlayedCards((prevPlayed) => prevPlayed.filter((c) => c.id !== card.id));
    setRecipes((prev) => prev + (card.cost || 0)); // предполагается, что у карты есть поле cost
  };

  const handlePlayCard = () => {
    if (!selectedCardId) return;

    const cardToPlay = hand.find((c) => c.id === selectedCardId);
    if (!cardToPlay) return;

    try {
      const {
        hand: newHand,
        playedCards: newPlayed,
        recipes: newRecipes,
      } = playCardLogic({
        hand,
        playedCards,
        recipes,
        cardToPlay,
      });
      setHand(newHand);
      setPlayedCards(newPlayed);
      setRecipes(newRecipes);
      setSelectedCardId(null);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEndTurn = async () => {
    await endTurn(uid, lobbyId);
    setTurnEnded(true);

    if (!opponentTurnEnded) {
      setWaitingForOpponent(true);
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (!gameData) return <div>Ошибка загрузки игры</div>;

  return (
    <div className="game-container">
      {/* Кнопка завершения хода и таймер */}
      {!turnEnded && (
        <div className="turn-controls">
          <button className="end-turn-button" onClick={handleEndTurn}>
            Завершить ход ({timer})
          </button>
        </div>
      )}

      {waitingForOpponent && (
        <div className="waiting-message">
          Дождитесь завершения хода соперника...
        </div>
      )}

      {/* Верх: противник */}
      <div className="info-container top">
        <div className="hp-bar-container">
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{ width: `${gameData.opponent.hp}%` }}
            >
              <span className="hp-text">
                <FavoriteIcon fontSize="small" style={{ marginRight: 4 }} />
                {gameData.opponent.hp}/100
              </span>
            </div>
          </div>
        </div>
        <div className="nickname center">{gameData.opponent.nickname}</div>
      </div>

      {/* Сыгранные карты в центре */}
      <div className="played-cards-section">
        {playedCards.map((card) => (
          <div key={card.id} className="played-card">
            <img
              src={card.image_url}
              alt={card.name}
              className="played-card-img"
            />
            <div>{card.name}</div>
            {/* Кнопка отмены под картой */}
            <button
              className="undo-card-button"
              onClick={() => handleUndoCard(card)}
            >
              Отменить
            </button>
          </div>
        ))}
      </div>

      {/* Карты игрока */}
      <div className="hand-section">
        {hand.map((card) => {
          const isSelected = selectedCardId === card.id;
          return (
            <div
              key={card.id}
              className={`game-card ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedCardId(card.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayCard();
                }}
                className="play-card-button"
              >
                Разыграть
              </button>
              <img
                src={card.image_url}
                alt={card.name}
                className="game-card-img"
              />
              <div>{card.name}</div>
              <div>
                <FlashOnIcon fontSize="small" /> {card.attack}
              </div>
              <div>
                <SecurityIcon fontSize="small" /> {card.defense}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ресурсы */}
      <div className="recipes-container">
        <AutoAwesomeIcon fontSize="small" style={{ marginRight: 6 }} />
        <span>Рицепты: {recipes}</span>
      </div>

      {/* Низ: игрок */}
      <div className="info-container bottom">
        <div className="hp-bar-container">
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{ width: `${gameData.player.hp}%` }}
            >
              <span className="hp-text">
                <FavoriteIcon fontSize="small" style={{ marginRight: 4 }} />
                {gameData.player.hp}/100
              </span>
            </div>
          </div>
        </div>
        <div className="nickname center">{gameData.player.nickname}</div>
      </div>
    </div>
  );
}

export default GamePage;
