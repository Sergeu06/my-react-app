import React, { useState, useRef, useEffect } from "react";
import "./Profile.css";
import { useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, database, databaseRef } from "./firebase"; // db - Firestore, database - RealtimeDB
import { get } from "firebase/database";
import { renderCardStats } from "../utils/renderCardStats";

import FramedCard from "../utils/FramedCard";

const SHOWCASE_SLOTS = 4;
const ACHIEVEMENT_SLOTS = 3;

const ACHIEVEMENTS = [
  {
    id: "arena_wins",
    title: "Победитель арены",
    description: "Побеждайте в PvP матчах.",
    getValue: (data) => data.stats?.wins ?? 0,
    levels: [
      { value: 10, label: "10 побед" },
      { value: 50, label: "50 побед" },
      { value: 150, label: "150 побед" },
    ],
  },
  {
    id: "arena_matches",
    title: "Заядлый боец",
    description: "Сыграйте больше PvP матчей.",
    getValue: (data) => (data.stats?.wins ?? 0) + (data.stats?.losses ?? 0),
    levels: [
      { value: 20, label: "20 матчей" },
      { value: 100, label: "100 матчей" },
      { value: 300, label: "300 матчей" },
    ],
  },
  {
    id: "raid_veteran",
    title: "Ветеран рейдов",
    description: "Участвуйте в рейдах против боссов.",
    getValue: (data) => data.stats?.raid_count ?? 0,
    levels: [
      { value: 5, label: "5 рейдов" },
      { value: 25, label: "25 рейдов" },
      { value: 80, label: "80 рейдов" },
    ],
  },
  {
    id: "raid_damage",
    title: "Сокрушитель титанов",
    description: "Наносите урон боссам в рейдах.",
    getValue: (data) => data.stats?.total_damage_raid ?? 0,
    levels: [
      { value: 5000, label: "5 000 урона" },
      { value: 25000, label: "25 000 урона" },
      { value: 100000, label: "100 000 урона" },
    ],
  },
  {
    id: "collector",
    title: "Коллекционер",
    description: "Собирайте карты в инвентаре.",
    getValue: (data) => data.cards?.length ?? 0,
    levels: [
      { value: 10, label: "10 карт" },
      { value: 50, label: "50 карт" },
      { value: 120, label: "120 карт" },
    ],
  },
  {
    id: "level_master",
    title: "Мастер уровня",
    description: "Повышайте уровень профиля.",
    getValue: (data) => data.stats?.lvl ?? 1,
    levels: [
      { value: 10, label: "10 уровень" },
      { value: 30, label: "30 уровень" },
      { value: 60, label: "60 уровень" },
    ],
  },
  {
    id: "rich",
    title: "Богач",
    description: "Накопите золото.",
    getValue: (data) => Math.floor(data.balance ?? 0),
    levels: [
      { value: 500, label: "500 золота" },
      { value: 2500, label: "2 500 золота" },
      { value: 10000, label: "10 000 золота" },
    ],
  },
  {
    id: "recipes",
    title: "Алхимик рецептов",
    description: "Собирайте SecretRecipes.",
    getValue: (data) => data.SecretRecipes ?? 0,
    levels: [
      { value: 10, label: "10 рецептов" },
      { value: 50, label: "50 рецептов" },
      { value: 150, label: "150 рецептов" },
    ],
  },
  {
    id: "rating",
    title: "Признанный герой",
    description: "Повышайте рейтинг RI.",
    getValue: (data) => data.stats?.RI ?? 1000,
    levels: [
      { value: 1100, label: "RI 1100" },
      { value: 1250, label: "RI 1250" },
      { value: 1500, label: "RI 1500" },
    ],
  },
  {
    id: "xp_master",
    title: "Опытный стратег",
    description: "Набирайте опыт в боях.",
    getValue: (data) => data.stats?.xp ?? 0,
    levels: [
      { value: 500, label: "500 XP" },
      { value: 2000, label: "2 000 XP" },
      { value: 8000, label: "8 000 XP" },
    ],
  },
];

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
  const [achievementsShowcase, setAchievementsShowcase] = useState(
    Array(ACHIEVEMENT_SLOTS).fill(null)
  );
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [activeAchievementSlot, setActiveAchievementSlot] = useState(null);

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

  const hydrateCardsWithImages = async (cards) => {
    const imageIds = [
      ...new Set(
        cards
          .map((card) => card.original_id || card.card_id || card.id)
          .filter(Boolean)
      ),
    ];
    if (!imageIds.length) return cards;

    const imageEntries = await Promise.all(
      imageIds.map(async (cardId) => {
        try {
          const snap = await getDoc(doc(db, "cards", cardId));
          return snap.exists() ? [cardId, snap.data()?.image_url || ""] : null;
        } catch (error) {
          console.warn("Не удалось загрузить изображение карты:", error);
          return null;
        }
      })
    );
    const imageMap = new Map(imageEntries.filter(Boolean));
    return cards.map((card) => ({
      ...card,
      image_url:
        card.image_url ||
        imageMap.get(card.original_id || card.card_id || card.id) ||
        "",
    }));
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
        const loadedAchievements =
          data.achievements_showcase || Array(ACHIEVEMENT_SLOTS).fill(null);
        setAchievementsShowcase(loadedAchievements);

        // Для витрины загружаем карты, которые там выставлены
        const showcaseCardIds = loadedShowcase.filter(Boolean); // убрать null
        const showcaseCardsRaw =
          await loadCardsFromRealtimeDB(showcaseCardIds);
        const showcaseCards = await hydrateCardsWithImages(showcaseCardsRaw);

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
          const hydratedCards = await hydrateCardsWithImages(allCards);
          setUserCards(hydratedCards);
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

  const saveAchievementsShowcase = async (newShowcase) => {
    if (!isOwnProfile) return;
    try {
      await updateDoc(doc(db, "users", currentUserId), {
        achievements_showcase: newShowcase,
      });
      setAchievementsShowcase(newShowcase);
    } catch (error) {
      console.error("Ошибка сохранения ачивок:", error);
    }
  };

  const getAchievementProgress = (achievement, data) => {
    const value = achievement.getValue(data);
    const achievedLevels = achievement.levels.filter(
      (level) => value >= level.value
    ).length;
    const nextLevel = achievement.levels[achievedLevels] || null;
    return {
      value,
      achievedLevels,
      nextLevel,
      maxLevel: achievement.levels.length,
    };
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

  const handleAchievementSelect = (achievementId) => {
    if (activeAchievementSlot === null || !isOwnProfile) return;
    const updated = [...achievementsShowcase];
    for (let i = 0; i < updated.length; i += 1) {
      if (i !== activeAchievementSlot && updated[i] === achievementId) {
        updated[i] = null;
      }
    }
    updated[activeAchievementSlot] = achievementId;
    saveAchievementsShowcase(updated);
    setShowAchievementModal(false);
    setActiveAchievementSlot(null);
  };

  const removeAchievementSlot = (slotIndex) => {
    if (!isOwnProfile) return;
    const updated = [...achievementsShowcase];
    updated[slotIndex] = null;
    saveAchievementsShowcase(updated);
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
        className={`profile-avatar ${isOwnProfile ? "clickable" : ""}`}
        onClick={() => isOwnProfile && setShowModal(true)}
        title={isOwnProfile ? "Кликните для смены аватара" : undefined}
      >
        <img
          src={profileData.avatar_url || "/default-avatar.png"}
          alt="Avatar"
        />
        <div className="avatar-level">{currentLevel}</div>
      </div>

      <div className="profile-info">
        <h2>{profileData.nickname || "Без имени"}</h2>
        <p className="uid">
          <span>ID : </span> {idToLoad}
        </p>
      </div>

      {/* Витрина из 4 слотов */}
      <div className="showcase-container">
        <h3>Витрина карт</h3>
        <div className="showcase-slots">
          {showcase.map((cardId, index) => {
            const card = userCards.find((c) => c.id === cardId) || null;

            if (card) {
              // Только карта, без пустого слота
              return (
                <div
                  key={index}
                  className={`showcase-slot filled ${
                    isOwnProfile ? "clickable" : ""
                  }`}
                  onClick={() => {
                    if (!isOwnProfile) return;
                    setActiveSlotIndex(index);
                    setShowCardModal(true);
                  }}
                >
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

                  {/* Отображаем характеристики */}
                  {(() => {
                    const stats = renderCardStats(card);
                    return stats.length > 0 ? (
                      <div className="card-stat-text">
                        {stats.map((stat, idx) => (
                          <div key={idx}>
                            {stat.label}{" "}
                            {stat.value !== undefined ? stat.value : ""}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            }

            // Пустой слот
            return (
              <div
                key={index}
                className={`showcase-slot empty ${
                  isOwnProfile ? "clickable" : ""
                }`}
                onClick={() => {
                  if (!isOwnProfile) return;
                  setActiveSlotIndex(index);
                  setShowCardModal(true);
                }}
                title="Кликните, чтобы добавить карту"
              >
                <div className="empty-slot-placeholder">Пусто</div>
              </div>
            );
          })}
        </div>

        {/* Модальное окно выбора карты */}
        {/* Модальное окно выбора карты */}
        {showCardModal && (
          <div
            className="card-modal"
            onClick={() => {
              setShowCardModal(false);
              setSelectedCard(null);
            }}
          >
            <div
              className="card-modal-content"
              onClick={(e) => e.stopPropagation()} // предотвращаем закрытие при клике внутри
            >
              {/* Список карт */}
              <div
                className="card-list card-list--modal"
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
                  >
                    <FramedCard card={card} showLevel={true} />
                  </div>
                ))}
              </div>
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
        <div className="stat">РИ: {profileData.stats?.RI ?? 1000}</div>

        <div className="stat">
          Рейдов сыграно: {profileData.stats?.raid_count ?? 0}
        </div>
        <div className="stat">
          Всего урона боссу: {profileData.stats?.total_damage_raid ?? 0}
        </div>
      </div>

      <div className="achievements-section">
        <h3>Ачивки</h3>
        {isOwnProfile && (
          <p className="achievements-hint">
            Выполняйте условия и выставляйте любимые достижения в профиль.
          </p>
        )}
        <div className="achievement-slots">
          {achievementsShowcase.map((achievementId, index) => {
            const achievement = ACHIEVEMENTS.find(
              (item) => item.id === achievementId
            );
            if (achievement) {
              const progress = getAchievementProgress(
                achievement,
                profileData
              );
              return (
                <div key={achievement.id} className="achievement-slot filled">
                  <div className="achievement-title">{achievement.title}</div>
                  <div className="achievement-level">
                    Уровень {progress.achievedLevels}/{progress.maxLevel}
                  </div>
                  <div className="achievement-progress">
                    {progress.nextLevel
                      ? `${progress.value}/${progress.nextLevel.value}`
                      : "Максимум"}
                  </div>
                  {isOwnProfile && (
                    <button
                      className="achievement-remove"
                      onClick={() => removeAchievementSlot(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            }

            return (
              <button
                key={`achievement-slot-${index}`}
                className="achievement-slot empty"
                onClick={() => {
                  if (!isOwnProfile) return;
                  setActiveAchievementSlot(index);
                  setShowAchievementModal(true);
                }}
                type="button"
              >
                <span>Выбрать</span>
              </button>
            );
          })}
        </div>

        {isOwnProfile && (
          <div className="achievement-list">
            {ACHIEVEMENTS.map((achievement) => {
              const progress = getAchievementProgress(
                achievement,
                profileData
              );
              return (
                <div key={achievement.id} className="achievement-card">
                  <div className="achievement-card-header">
                    <div>
                      <h4>{achievement.title}</h4>
                      <p>{achievement.description}</p>
                    </div>
                    <div className="achievement-level">
                      {progress.achievedLevels}/{progress.maxLevel}
                    </div>
                  </div>
                  <ul>
                    {achievement.levels.map((level, idx) => (
                      <li
                        key={level.value}
                        className={
                          progress.achievedLevels > idx ? "done" : ""
                        }
                      >
                        {level.label}
                      </li>
                    ))}
                  </ul>
                  <div className="achievement-progress">
                    Прогресс:{" "}
                    {progress.nextLevel
                      ? `${progress.value}/${progress.nextLevel.value}`
                      : "Достигнут максимум"}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showAchievementModal && isOwnProfile && (
          <div
            className="modal-overlay"
            onClick={() => setShowAchievementModal(false)}
          >
            <div
              className="modal-window achievement-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="close-button"
                onClick={() => setShowAchievementModal(false)}
              >
                ✕
              </button>
              <h3>Выберите ачивку</h3>
              <div className="achievement-modal-list">
                {ACHIEVEMENTS.map((achievement) => {
                  const progress = getAchievementProgress(
                    achievement,
                    profileData
                  );
                  return (
                    <button
                      key={achievement.id}
                      type="button"
                      className="achievement-modal-item"
                      onClick={() => handleAchievementSelect(achievement.id)}
                    >
                      <div className="achievement-title">
                        {achievement.title}
                      </div>
                      <div className="achievement-progress">
                        Уровень {progress.achievedLevels}/
                        {progress.maxLevel}
                      </div>
                      <div className="achievement-progress">
                        {progress.nextLevel
                          ? `${progress.value}/${progress.nextLevel.value}`
                          : "Максимум"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
