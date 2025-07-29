import React, { useState, useEffect, useRef } from "react";
import {
  ref,
  get,
  push,
  update,
  onValue,
  set as rtdbSet,
} from "firebase/database";
import { db, database } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

import { useNavigate } from "react-router-dom";
import "./FightPage.css"; // <- импорт стилей

function FightPage({ uid }) {
  const [isSearching, setIsSearching] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [lobbyId, setLobbyId] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [playersInLobby, setPlayersInLobby] = useState(0);
  const [introStage, setIntroStage] = useState(null);
  const [tip, setTip] = useState(null);
  const [player1Name, setPlayer1Name] = useState("");
  const [player2Name, setPlayer2Name] = useState("");
  const [activeSkill, setActiveSkill] = useState("");
  const [skillList, setSkillList] = useState([]);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const isCancelled = useRef(false);
  const navigate = useNavigate();

  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [fullLeaderboard, setFullLeaderboard] = useState([]);

  useEffect(() => {
    const fetchSkills = async () => {
      const userDoc = await getDoc(doc(db, "users", uid));
      const data = userDoc.data();
      setSkillList(data.active_skill || []);
      setActiveSkill(data.active_skill_i || "");
    };
    if (uid) fetchSkills();
  }, [uid]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const usersCollection = collection(db, "users");
        // Запрос: получить топ 3 по урону в рейде, урон может быть вложенным,
        // но orderBy с вложенными полями поддерживается (например "stats.total_damage_raid").
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
            damage: data.stats?.total_damage_raid || 0,
          });
        });

        setLeaderboard(topPlayers);
      } catch (error) {
        console.error("Ошибка загрузки лидерборда из Firestore:", error);
      }
    };

    fetchLeaderboard();
  }, []);

  const openLeaderboardModal = async () => {
    setShowLeaderboardModal(true);
    try {
      const usersCollection = collection(db, "users");
      const leaderboardQuery = query(
        usersCollection,
        orderBy("stats.total_damage_raid", "desc")
        // Можно поставить лимит, если нужно, или убрать, чтобы получить всех
      );

      const querySnapshot = await getDocs(leaderboardQuery);
      const playersArray = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        playersArray.push({
          userId: docSnap.id,
          nickname: data.nickname || "Игрок",
          avatar: data.avatar_url || "/default-avatar.png",
          damage: data.stats?.total_damage_raid || 0,
        });
      });

      setFullLeaderboard(playersArray);
    } catch (error) {
      console.error("Ошибка загрузки полного лидерборда из Firestore:", error);
    }
  };

  const closeLeaderboardModal = () => {
    setShowLeaderboardModal(false);
  };

  const handleEquipSkill = async (skill) => {
    try {
      await updateDoc(doc(db, "users", uid), { active_skill_i: skill });
      setActiveSkill(skill);
      setShowSkillModal(false);
    } catch (err) {
      console.error("Ошибка при установке активного навыка:", err);
    }
  };

  const handleOpenProfile = (profileUserId) => {
    setShowLeaderboardModal(false);
    navigate(`/profile/${profileUserId}?start=${uid}`);
  };

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
      tipTimeout = setTimeout(showTip, Math.floor(Math.random() * 5000) + 5000);
    };
    showTip();

    return () => clearTimeout(tipTimeout);
  }, [isSearching]);

  useEffect(() => {
    if (!isSearching) return setSecondsElapsed(0);
    const interval = setInterval(
      () => setSecondsElapsed((prev) => prev + 1),
      1000
    );
    return () => clearInterval(interval);
  }, [isSearching]);

  const handleSearchOpponent = async () => {
    if (!uid) return console.error("UID не передан");
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      const deck = userDoc.data()?.deck_pvp || [];
      if (deck.length < 7) {
        alert("Минимум 7 карты!");
        return;
      }
    } catch (err) {
      console.error("Ошибка загрузки колоды:", err);
      return;
    }

    isCancelled.current = false;
    setIsSearching(true);
    setSecondsElapsed(0);

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
        console.log("Присоединился к лобби:", id);
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
      console.log("Создано новое лобби:", joinedLobbyId);
    }

    setLobbyId(joinedLobbyId);
  };

  const handleCancelSearch = async () => {
    isCancelled.current = true;
    setIsSearching(false);
    setSecondsElapsed(0);

    if (!lobbyId) return;

    const lobbyRef = ref(database, `lobbies/${lobbyId}`);
    const snapshot = await get(lobbyRef);
    const lobby = snapshot.val();

    if (!lobby) return;

    if (lobby.players?.length === 1 && lobby.players[0] === uid) {
      await rtdbSet(lobbyRef, null);
      console.log("Удалено лобби:", lobbyId);
    } else {
      const updatedPlayers = lobby.players.filter((p) => p !== uid);
      await update(lobbyRef, { players: updatedPlayers });
      console.log("Вышел из лобби:", lobbyId);
    }

    setLobbyId(null);
    setPlayersInLobby(0);
    setCountdown(null);
    setIntroStage(null);
  };

  useEffect(() => {
    if (!lobbyId) return;

    const lobbyRef = ref(database, `lobbies/${lobbyId}`);
    const unsubscribe = onValue(lobbyRef, async (snapshot) => {
      const lobby = snapshot.val();
      if (!lobby) {
        console.log("Лобби удалено сервером.");
        setLobbyId(null);
        setIsSearching(false);
        setPlayersInLobby(0);
        setCountdown(null);
        setIntroStage(null);
        return;
      }

      const playersCount = lobby.players?.length || 0;
      setPlayersInLobby(playersCount);
      if (typeof lobby.countdown === "number") {
        setCountdown(lobby.countdown);
      }

      console.log("Текущее лобби:", lobby);

      if (
        playersCount === 2 &&
        lobby.status === "waiting" &&
        lobby.players[0] === uid
      ) {
        console.log("Я хост, запускаю countdown...");
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
            console.log("Countdown завершен.");
          }
        }, 1000);
      }

      if (
        playersCount === 2 &&
        lobby.status === "Play" &&
        lobby.countdown === 0
      ) {
        console.log("Начинаем бой!");

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
  }, [lobbyId, uid, navigate]);

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div>
      <div style={{ position: "relative", zIndex: 10 }}>
        {/* --- Лидерборд в правом верхнем углу --- */}
        <div style={{ position: "relative", zIndex: 10 }}>
          {/* --- Лидерборд в правом верхнем углу --- */}
          <div
            className="leaderboard-container"
            onClick={openLeaderboardModal}
            title="Кликните для просмотра полного списка"
          >
            <h4>Лидерборд рейда</h4>
            {leaderboard.length === 0 && <p>Загрузка...</p>}
            {leaderboard.map((player, index) => (
              <div
                key={player.userId}
                title={`${player.nickname} — урон: ${player.damage}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 0",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: "bold", width: 20 }}>
                  {index + 1}.
                </span>
                <img
                  src={player.avatar}
                  alt={player.nickname}
                  style={{
                    width: 32,
                    height: 32,
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
                    minWidth: 50,
                    textAlign: "right",
                  }}
                >
                  {player.damage.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* --- Модальное окно полного лидерборда --- */}
          {showLeaderboardModal && (
            <div className="modal-overlay" onClick={closeLeaderboardModal}>
              <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: "80vh", overflowY: "auto" }}
              >
                <button
                  className="close-button"
                  onClick={closeLeaderboardModal}
                  aria-label="Закрыть"
                >
                  &times;
                </button>

                <h3>Полный лидерборд рейда</h3>
                {fullLeaderboard.length === 0 && <p>Загрузка...</p>}
                {fullLeaderboard.map((player, index) => (
                  <div
                    key={player.userId}
                    className="player-row"
                    title={`${player.nickname} — урон: ${player.damage}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 0",
                      borderBottom: "1px solid #333",
                      cursor: "pointer", // добавить курсор-указатель
                    }}
                    onClick={() => handleOpenProfile(player.userId)} // добавляем обработчик клика
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
                      {player.damage.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 🧠 Блок выбора навыка */}
        <div className="skill-slot-container">
          <button
            className="skill-slot-button"
            onClick={() => setShowSkillModal(true)}
          >
            {activeSkill ? `🎯 ${activeSkill}` : "🌀 Навык не выбран"}
          </button>
        </div>

        {showSkillModal && (
          <div className="modal-overlay">
            <div className="modal-window">
              <button
                className="close-button"
                onClick={() => setShowSkillModal(false)}
              >
                ✕
              </button>
              <h3>Выберите активный навык</h3>
              {skillList.length === 0 ? (
                <p>Нет доступных навыков</p>
              ) : (
                <ul className="skill-list">
                  {skillList.map((skill) => (
                    <li key={skill}>
                      <button
                        className="skill-option-button"
                        onClick={() => handleEquipSkill(skill)}
                      >
                        {skill}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {introStage && (
          <div className="fight-countdown-overlay">
            {introStage === "player1" && <p>⚔️ {player1Name}</p>}
            {introStage === "vs" && <p>VS</p>}
            {introStage === "player2" && <p>🛡️ {player2Name}</p>}
            {introStage === "countdown" && <p>Fight!</p>}
          </div>
        )}

        {tip && <div className="fight-tip">{tip}</div>}

        {isSearching && playersInLobby < 2 && (
          <div className="fight-overlay">
            <div className="fight-spinner"></div>
            <p className="fight-time">{formatTime(secondsElapsed)}</p>
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
              <button
                className="fight-btn-search"
                onClick={handleSearchOpponent}
              >
                Поиск соперника
              </button>
              <button
                className="fight-btn-raid"
                onClick={async () => {
                  try {
                    const userDoc = await getDoc(doc(db, "users", uid));
                    const raidDeck = userDoc.data()?.deck_raid || [];
                    if (raidDeck.length < 3) {
                      alert(
                        "Для участия в рейде необходимо минимум 7 карт в колоде raid!"
                      );
                      return;
                    }
                    navigate(`/Raid?start=${uid}`);
                  } catch (error) {
                    console.error("Ошибка проверки колоды для рейда:", error);
                    alert("Ошибка загрузки данных. Попробуйте позже.");
                  }
                }}
              >
                Рейд
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FightPage;
