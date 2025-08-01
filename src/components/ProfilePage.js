import React, { useState, useRef, useEffect } from "react";
import "./Profile.css";
import { useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, database, databaseRef } from "./firebase"; // db - Firestore, database - RealtimeDB
import { get } from "firebase/database";
import { toRoman } from "../utils/toRoman";
import { renderCardStats } from "../utils/renderCardStats";

import FramedCard from "../utils/FramedCard";

const SHOWCASE_SLOTS = 4;
const MAX_LEVEL = 100;

const ProfilePage = () => {
  const { userId: paramUserId } = useParams();
  const [searchParams] = useSearchParams();
  const currentUserId = searchParams.get("start");

  const idToLoad = paramUserId || currentUserId;
  const isOwnProfile = idToLoad === currentUserId;
  const [selectedCard, setSelectedCard] = useState(null);

  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const currentLevelRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [activeSlotIndex, setActiveSlotIndex] = useState(null);

  const [showcase, setShowcase] = useState(Array(SHOWCASE_SLOTS).fill(null));
  const [userCards, setUserCards] = useState([]); // карты для выбора

  // Загрузка карт из колоды в RealtimeDB
  const loadCardsFromDeck = async (deckName, cardKeys) => {
    if (!cardKeys.length) return [];
    const promises = cardKeys.map(async (cardId) => {
      const snap = await get(databaseRef(database, `cards/${cardId}`));
      if (snap.exists()) return { id: cardId, ...snap.val() };
      return null;
    });
    const cards = await Promise.all(promises);
    return cards.filter(Boolean);
  };

  // Загрузка карт из основной коллекции cards RealtimeDB
  const loadCardsFromRealtimeDB = async (cardKeys) => {
    if (!cardKeys.length) return [];
    const promises = cardKeys.map(async (key) => {
      const snap = await get(databaseRef(database, `cards/${key}`));
      if (snap.exists()) return { id: key, ...snap.val() };
      return null;
    });
    const cards = await Promise.all(promises);
    return cards.filter(Boolean);
  };

  useEffect(() => {
    if (!idToLoad) {
      setProfileError("Не указан пользователь");
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);

    (async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", idToLoad));
        if (!docSnap.exists()) {
          setProfileError("Пользователь не найден");
          setProfileData(null);
          setLoadingProfile(false);
          return;
        }

        const data = docSnap.data();
        setProfileData(data);

        // Загружаем витрину — ID карт
        const loadedShowcase =
          data.showcase || Array(SHOWCASE_SLOTS).fill(null);
        setShowcase(loadedShowcase);

        // Для витрины загружаем карты, которые там выставлены
        const showcaseCardIds = loadedShowcase.filter(Boolean); // убрать null
        const showcaseCards = await loadCardsFromRealtimeDB(showcaseCardIds);

        // Для собственного профиля дополнительно загружаем все карты пользователя для выбора
        if (isOwnProfile) {
          const cardKeys = data.cards || [];
          const deckRaid = new Set(data.deck_raid || []);
          const deckPvp = new Set(data.deck_pvp || []);

          const pvpCardsRaw = await loadCardsFromDeck(
            "deck_pvp",
            Array.from(deckPvp)
          );
          const raidCardsRaw = await loadCardsFromDeck(
            "deck_raid",
            Array.from(deckRaid)
          );
          const mainCardsRaw = await loadCardsFromRealtimeDB(cardKeys);

          const combinedMap = new Map();
          [...mainCardsRaw, ...pvpCardsRaw, ...raidCardsRaw].forEach((card) => {
            const inRaid = deckRaid.has(card.id);
            const inPvp = deckPvp.has(card.id);
            combinedMap.set(card.id, { ...card, inRaid, inPvp });
          });

          const allCards = Array.from(combinedMap.values());
          setUserCards(allCards);
        } else {
          // Для чужого профиля показываем только карты из витрины
          setUserCards(showcaseCards);
        }

        setLoadingProfile(false);
      } catch {
        setProfileError("Ошибка загрузки данных");
        setProfileData(null);
        setLoadingProfile(false);
      }
    })();
  }, [idToLoad, isOwnProfile]);

  // Автоскролл к текущему уровню
  useEffect(() => {
    if (currentLevelRef.current) {
      currentLevelRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
      });
    }
  }, [profileData]);

  // Сохраняем витрину в Firestore
  const saveShowcase = async (newShowcase) => {
    if (!isOwnProfile) return;
    try {
      await updateDoc(doc(db, "users", currentUserId), {
        showcase: newShowcase,
      });
      setShowcase(newShowcase);
    } catch (error) {
      console.error("Ошибка сохранения витрины:", error);
    }
  };

  const placeCardInSlot = (card, slotIndex) => {
    if (!isOwnProfile) return;

    const newShowcase = [...showcase];

    // Удаляем карту из других слотов, если она там есть
    for (let i = 0; i < newShowcase.length; i++) {
      if (i !== slotIndex && newShowcase[i] === card.id) {
        newShowcase[i] = null;
      }
    }

    // Ставим карту в выбранный слот
    newShowcase[slotIndex] = card.id;

    saveShowcase(newShowcase);
  };
  const removeCardFromSlot = (slotIndex) => {
    if (!isOwnProfile) return;
    const newShowcase = [...showcase];
    newShowcase[slotIndex] = null;
    saveShowcase(newShowcase);
  };

  const handleCardClick = (card) => {
    setSelectedCard(card);
    if (activeSlotIndex !== null) {
      placeCardInSlot(card, activeSlotIndex);
      setShowCardModal(false);
      setSelectedCard(null);
      setActiveSlotIndex(null);
    }
  };

  if (loadingProfile)
    return (
      <div className="profile-skeleton">
        <div className="skeleton-circle" />
        <div className="skeleton-line short" />
        <div className="skeleton-line long" />
      </div>
    );

  if (profileError) return <p className="error-message">{profileError}</p>;
  if (!profileData)
    return <p className="error-message">Пользователь не найден.</p>;

  const currentLevel = profileData.stats?.lvl ?? 1;
  const currentXp = profileData.stats?.xp ?? 0;

  return (
    <div className="profile-container">
      <div
        className="profile-avatar"
        onClick={() => isOwnProfile && setShowModal(true)}
        style={{ cursor: isOwnProfile ? "pointer" : "default" }}
        title={isOwnProfile ? "Кликните для смены аватара" : undefined}
      >
        <img
          src={profileData.avatar_url || "/default-avatar.png"}
          alt="Avatar"
        />
        <div className="avatar-level">{currentLevel}</div>
      </div>

      <div className="profile-info">
        <h2>
          {profileData.nickname || "Без имени"}
          {isOwnProfile && " (вы)"}
        </h2>
        <p className="uid">
          <span>ID : </span> {idToLoad}
        </p>
      </div>

      {/* Шкала уровней и наград */}
      <div className="level-reward-wrapper">
        <h3>Награды за уровень</h3>
        <div className="level-reward-scroll-container">
          <div className="level-reward-bar">
            {Array.from({ length: MAX_LEVEL }, (_, i) => {
              const level = i + 1;
              const isSpecial = level % 10 === 0;
              const earned = currentLevel >= level;
              return (
                <div
                  key={level}
                  className={`level-marker ${earned ? "earned" : ""} ${
                    isSpecial ? "special" : ""
                  }`}
                  ref={level === currentLevel ? currentLevelRef : null}
                >
                  {level}
                  {level === currentLevel && isOwnProfile && (
                    <button className="claim-reward">Забрать</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Витрина из 4 слотов */}
      <div className="showcase-container">
        <h3>Витрина карт</h3>
        <div className="showcase-slots">
          {showcase.map((cardId, index) => {
            const card = userCards.find((c) => c.id === cardId) || null;
            return (
              <div
                key={index}
                className="showcase-slot"
                onClick={() => {
                  if (!isOwnProfile) return;
                  setActiveSlotIndex(index);
                  setShowCardModal(true);
                }}
                style={{
                  cursor: isOwnProfile ? "pointer" : "default",
                  position: "relative",
                }}
                title={
                  card
                    ? "Кликните, чтобы сменить карту"
                    : "Кликните, чтобы добавить карту"
                }
              >
                {card ? (
                  <>
                    {/* Используем FramedCard для отображения */}
                    <FramedCard
                      card={card}
                      showLevel={true}
                      onClick={() => {
                        if (!isOwnProfile) return;
                        setActiveSlotIndex(index);
                        setShowCardModal(true);
                      }}
                    />

                    {isOwnProfile && (
                      <button
                        className="remove-slot-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCardFromSlot(index);
                        }}
                      >
                        ×
                      </button>
                    )}

                    {(() => {
                      const stats = renderCardStats(card);
                      if (stats.length > 0) {
                        return (
                          <div className="card-stat-text">
                            {stats.map((stat, idx) => (
                              <div key={idx}>
                                {stat.label}{" "}
                                {stat.value !== undefined ? stat.value : ""}
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                ) : (
                  <div className="empty-slot-placeholder">Пусто</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Модальное окно выбора карты */}
        {showCardModal && (
          <div className="card-modal">
            <div
              className="card-modal-content"
              style={{ display: "flex", gap: "20px" }}
            >
              <button
                className="close-button"
                onClick={() => {
                  setShowCardModal(false);
                  setSelectedCard(null);
                }}
              >
                ✕
              </button>

              {/* Список карт */}
              <div
                className="card-list"
                style={{ flex: 1, maxHeight: "500px", overflowY: "auto" }}
              >
                <h2>Выберите карту для витрины</h2>
                {userCards.length === 0 && <p>У вас нет доступных карт.</p>}
                {userCards.map((card) => (
                  <div
                    key={card.id}
                    className={`card-style clickable ${
                      selectedCard?.id === card.id ? "selected" : ""
                    }`}
                    onClick={() => handleCardClick(card)}
                    style={{ position: "relative" }}
                  >
                    <div className="card-name">{card.name}</div>
                    <img src={card.image_url} alt={card.name} />
                    {card.lvl && (
                      <div className="card-level-overlay">
                        {toRoman(card.lvl)}
                      </div>
                    )}
                    {(card.inRaid || card.inPvp) && (
                      <div
                        style={{
                          marginBottom: 6,
                          fontSize: "14px",
                          color: "#ffa500",
                          fontStyle: "italic",
                        }}
                      >
                        В колоде {card.inRaid ? "(Рейд)" : ""}{" "}
                        {card.inPvp ? "(ПвП)" : ""}
                      </div>
                    )}

                    {/* Здесь добавляем блок с описанием характеристик */}
                    <div
                      className="card-stats-description"
                      style={{ fontSize: "12px", color: "#ccc", marginTop: 4 }}
                    >
                      {renderCardStats(card).map((stat, idx) => (
                        <div key={idx}>
                          <strong>{stat.label}</strong>{" "}
                          {stat.value !== undefined ? stat.value : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Убрана панель с подробной информацией и кнопкой выбора карты */}
            </div>
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="profile-stats">
        <div className="stat">XP: {currentXp}</div>
        <div className="stat">
          Золото: {(profileData.balance ?? 0).toFixed(2)}
        </div>
        <div className="stat">
          Тайные рецепты: {profileData.SecretRecipes ?? 0}
        </div>
        <div className="stat">Победы: {profileData.stats?.wins ?? 0}</div>
        <div className="stat">Поражения: {profileData.stats?.losses ?? 0}</div>
        <div className="stat">
          Рейдов сыграно: {profileData.stats?.raid_count ?? 0}
        </div>
        <div className="stat">
          Всего урона боссу: {profileData.stats?.total_damage_raid ?? 0}
        </div>
      </div>

      {/* Модальное окно смены аватара - только для своего профиля */}
      {showModal && isOwnProfile && (
        <div className="modal-overlay">
          <div className="modal-window">
            <button
              className="close-button"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <p>
              Сменить аватар можно в Telegram-боте по команде:
              <br />
              <a
                href="https://t.me/testapps_bot_bot?start=switch_avatar"
                target="_blank"
                rel="noopener noreferrer"
              >
                /switch_avatar
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
