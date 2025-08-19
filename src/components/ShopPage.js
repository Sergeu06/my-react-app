import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { database, databaseRef, set, db } from "./firebase";
import Market from "./Market";
import CardTooltip from "../utils/CardTooltip";
import FramedCard from "../utils/FramedCard";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import RarityIcon from "@mui/icons-material/Star";
import PriceIcon from "@mui/icons-material/AttachMoney";
import DamageIcon from "@mui/icons-material/FlashOn";
import { Select, MenuItem } from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";

import "./ShopPage.css";
import { useNavigate } from "react-router-dom";
import { getGlowColor } from "../utils/FramedCard";

function ShopPage({ uid }) {
  const [activeTab, setActiveTab] = useState("shop");
  const [selectedCard, setSelectedCard] = useState(null);
  const [isConfirmingPurchase, setIsConfirmingPurchase] = useState(false);
  const [error, setError] = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseAmount, setPurchaseAmount] = useState(1);
  const [tooltipCard, setTooltipCard] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [lootboxes, setLootboxes] = useState([]);
  const [showBoxInfo, setShowBoxInfo] = useState(false);
  const [boxInfoVisible, setBoxInfoVisible] = useState(false);
  const [isHidingBoxInfo, setIsHidingBoxInfo] = useState(false);
  const [boxCardsDetails, setBoxCardsDetails] = useState([]);
  const [loadingBoxCards, setLoadingBoxCards] = useState(false);
  const [, setAnimationCardData] = useState(null);
  const [, setAnimationAmount] = useState(1);
  const boxContentsCache = useRef({});
  const [lockedTooltip, setLockedTooltip] = useState(null);

  const navigate = useNavigate();
  const rarityAccessLevel = {
    обычная: 1,
    редкая: 3,
    эпическая: 5,
    легендарная: 7,
  };
  useEffect(() => {
    if (showBoxInfo) {
      // Показать с небольшой задержкой (для анимации)
      const timer = setTimeout(() => setBoxInfoVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      // Начать анимацию скрытия
      setIsHidingBoxInfo(true);
      const timer = setTimeout(() => {
        setBoxInfoVisible(false);
        setIsHidingBoxInfo(false);
      }, 400); // Время должно совпадать с transition
      return () => clearTimeout(timer);
    }
  }, [showBoxInfo]);

  useEffect(() => {
    const fetchLootboxes = async () => {
      try {
        const snapshot = await getDocs(collection(db, "box"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLootboxes(data);
      } catch (err) {
        console.error("[Лутбоксы] Ошибка загрузки:", err);
      }
    };
    fetchLootboxes();
  }, []);

  const sortOptions = [
    {
      value: "rarity",
      icon: <RarityIcon sx={{ color: "#ffa500", mr: 1 }} />,
      label: "Редкость",
    },
    {
      value: "price",
      icon: <PriceIcon sx={{ color: "#ffa500", mr: 1 }} />,
      label: "Цена",
    },
    {
      value: "characteristic",
      icon: <DamageIcon sx={{ color: "#ffa500", mr: 1 }} />,
      label: "Характеристика",
    }, // заменили 'damage' на 'characteristic'
  ];
  const [sortCriterion, setSortCriterion] = useState("rarity");
  const holdTimer = useRef(null);
  const characteristicGroupsOrder = ["damage", "heal", "damage_multiplier"];

  function getMainCharacteristic(card) {
    // Создаем массив пар [характеристика, значение]
    const characteristics = [
      ["damage", card.damage || 0],
      ["heal", card.heal || 0],
      ["damage_multiplier", card.damage_multiplier || 0],
    ];

    // Фильтруем нулевые и сортируем по убыванию значения
    const filtered = characteristics.filter(([_, val]) => val > 0);
    if (filtered.length === 0) return { type: null, value: 0 };

    filtered.sort((a, b) => b[1] - a[1]);
    const [type, value] = filtered[0];
    return { type, value };
  }

  const handleTouchStart = (card, event) => {
    const touch = event.touches ? event.touches[0] : event;
    holdTimer.current = setTimeout(() => {
      setTooltipCard(card);
      setTooltipPosition({ x: touch.clientX, y: touch.clientY });
    }, 500);
  };
  const handleLockedCardClick = (card) => {
    setLockedTooltip(
      `Карта "${card.name}" доступна с уровня ${card.requiredLevel}`
    );
    setTimeout(() => setLockedTooltip(null), 3500);
  };
  const handleTouchEnd = () => {
    clearTimeout(holdTimer.current);
    setTooltipCard(null);
    setTooltipPosition(null);
  };

  useEffect(() => {
    if (activeTab === "shop") fetchCards();
  }, [activeTab]);

  const handleTabChange = (tab) => setActiveTab(tab);

  const handlePurchaseClick = () => {
    if (!selectedCard) return;

    if (selectedCard.rarity === "lootbox") {
      // Для ланчбокса показываем анимацию
      setAnimationCardData(selectedCard);
      setAnimationAmount(1); // ланчбокс всегда 1 штука
      setIsConfirmingPurchase(false);
    } else {
      // Для карт — сразу покупаем без анимации
      handleBuyCard();
    }
  };

  const fetchBoxCardsDetails = async (boxId, rarityChances) => {
    // Проверка кеша
    if (boxContentsCache.current[boxId]) {
      setBoxCardsDetails(boxContentsCache.current[boxId]);
      return;
    }

    setLoadingBoxCards(true);
    try {
      const boxDocRef = doc(db, "box", boxId);
      const boxDocSnap = await getDoc(boxDocRef);

      if (!boxDocSnap.exists()) {
        setBoxCardsDetails([]);
        setLoadingBoxCards(false);
        return;
      }

      const boxData = boxDocSnap.data();
      const cardIds = boxData.cards || [];

      if (cardIds.length === 0) {
        setBoxCardsDetails([]);
        setLoadingBoxCards(false);
        return;
      }

      const boxCards = [];

      for (const cardId of cardIds) {
        const cardSnap = await getDoc(doc(db, "cards", cardId));
        if (cardSnap.exists()) {
          const cardData = cardSnap.data();
          boxCards.push({
            card_id: cardId,
            name: cardData.name || "Без имени",
            rarity: (cardData.rarity || "обычная").toLowerCase(),
          });
        }
      }

      const rarityCountMap = {};
      boxCards.forEach((c) => {
        rarityCountMap[c.rarity] = (rarityCountMap[c.rarity] || 0) + 1;
      });

      const boxCardsWithChance = boxCards.map((card) => {
        const rarityKey =
          card.rarity.charAt(0).toUpperCase() +
          card.rarity.slice(1).toLowerCase();

        const totalChance = rarityChances[rarityKey] || 0;
        const count = rarityCountMap[card.rarity] || 1;
        const chance = (totalChance / count).toFixed(2);

        return { ...card, chance };
      });

      // ⬅️ Сохраняем в кеш
      boxContentsCache.current[boxId] = boxCardsWithChance;
      setBoxCardsDetails(boxCardsWithChance);
    } catch (err) {
      console.error("Ошибка загрузки содержимого коробки:", err);
      setBoxCardsDetails([]);
    } finally {
      setLoadingBoxCards(false);
    }
  };

  const fetchCards = async () => {
    try {
      setIsLoading(true);
      const shopSnapshot = await getDocs(collection(db, "shop"));
      if (shopSnapshot.empty) {
        setError("На рынке нет карт.");
        setIsLoading(false);
        return;
      }

      const shopCardsMap = {};
      shopSnapshot.forEach((doc) => {
        const data = doc.data();
        shopCardsMap[doc.id] = {
          price: data.price || 0,
          quantity: data.quantity || 0,
          total_quantity: data.total_quantity || 0,
          increase: data.increase,
        };
      });

      const cardIds = Object.keys(shopCardsMap);
      const cardsSnapshot = await getDocs(collection(db, "cards"));
      const cardsMap = {};
      cardsSnapshot.forEach((doc) => {
        if (cardIds.includes(doc.id)) cardsMap[doc.id] = doc.data();
      });

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const userLevel = userSnap.exists() ? userSnap.data().stats.lvl || 1 : 1;

      const cardsData = cardIds.map((cardId) => {
        const card = cardsMap[cardId] || {};
        const shopItem = shopCardsMap[cardId] || {};
        const rarity = (card.rarity || "обычная").toLowerCase();
        const requiredLevel = rarityAccessLevel[rarity] || 1;
        const locked = userLevel < requiredLevel;

        return {
          card_id: cardId,
          name: card.name || "Без имени",
          image_url: card.image_url || "",
          description: card.description || "",
          price: shopItem.price,
          quantity: shopItem.quantity,
          total_quantity: shopItem.total_quantity,
          priority: card.priority,
          damage: card.damage,
          damage_multiplier: card.damage_multiplier,
          remove_multiplier: card.remove_multiplier,
          damage_over_time: card.damage_over_time || [],
          heal: card.heal,
          requiredLevel,
          rarity,
          locked,
        };
      });

      setAllCards(cardsData);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить карты.");
    } finally {
      setIsLoading(false);
    }
  };
  const groupCardsByCharacteristic = (cards) => {
    const groups = {
      damage: [],
      heal: [],
      damage_multiplier: [],
      other: [],
    };

    for (const card of cards) {
      const { type } = getMainCharacteristic(card);
      if (type && groups[type]) {
        groups[type].push(card);
      } else {
        groups.other.push(card);
      }
    }

    return groups;
  };

  const handleBuyCard = async () => {
    if (!selectedCard || purchaseAmount <= 0 || selectedCard.quantity <= 0) {
      setError("Недопустимые параметры покупки.");
      return;
    }
    if (selectedCard.locked) {
      setError("Карта недоступна для вашего уровня.");
      return;
    }

    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("Пользователь не найден.");
      const userData = userSnap.data();
      const totalCost = selectedCard.price * purchaseAmount;

      if ((userData.balance || 0) < totalCost) {
        setError("Недостаточно средств.");
        return;
      }

      if (purchaseAmount > selectedCard.quantity) {
        setError("Недостаточно карт в наличии.");
        return;
      }

      const originalSnap = await getDoc(doc(db, "cards", selectedCard.card_id));
      if (!originalSnap.exists())
        throw new Error("Оригинальная карта не найдена.");
      const cardData = originalSnap.data();

      const newCardIds = [];
      for (let i = 0; i < purchaseAmount; i++) {
        const newId = crypto.randomUUID();
        await set(databaseRef(database, `cards/${newId}`), {
          ...cardData,
          lvl: 1,
          owner: uid,
          fleet: parseFloat(Math.random().toFixed(10)),
          sell: false,
          original_id: selectedCard.card_id,
          upgradeBonus: 0,
          increase: cardData.increase ?? 1,
        });
        newCardIds.push(newId);
      }

      await updateDoc(userRef, {
        balance: userData.balance - totalCost,
        cards: arrayUnion(...newCardIds),
      });

      await updateDoc(doc(db, "shop", selectedCard.card_id), {
        quantity: selectedCard.quantity - purchaseAmount,
      });

      setAllCards((prev) =>
        prev.map((c) =>
          c.card_id === selectedCard.card_id
            ? { ...c, quantity: c.quantity - purchaseAmount }
            : c
        )
      );

      setSelectedCard(null);
      setIsConfirmingPurchase(false);
      setError(null);
      setPurchaseAmount(1);
    } catch (err) {
      console.error("[Покупка] Ошибка:", err);
      setError("Не удалось купить карту.");
    }
  };

  const rarityOrder = { обычная: 1, редкая: 2, эпическая: 3, легендарная: 4 };

  const sortCards = (cards) => {
    return [...cards].sort((a, b) => {
      if (sortCriterion === "rarity") {
        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
      }
      if (sortCriterion === "price") {
        return b.price - a.price;
      }
      if (sortCriterion === "characteristic") {
        const aChar = getMainCharacteristic(a);
        const bChar = getMainCharacteristic(b);

        // Если у одной из карт нет характеристики, она уходит вниз
        if (!aChar.type && !bChar.type) return 0;
        if (!aChar.type) return 1;
        if (!bChar.type) return -1;

        // Сравниваем по порядку групп
        const orderA = characteristicGroupsOrder.indexOf(aChar.type);
        const orderB = characteristicGroupsOrder.indexOf(bChar.type);

        if (orderA !== orderB) return orderA - orderB; // меньший индекс — выше

        // Если группа совпала, сортируем по значению по убыванию
        return bChar.value - aChar.value;
      }
      return 0;
    });
  };
  const groupedCards = groupCardsByCharacteristic(sortCards(allCards));
  const categoryNames = {
    damage: "Боевые карты (Урон)",
    heal: "Карты лечения",
    damage_multiplier: "Усилители урона",
    other: "Прочие карты",
  };

  const handleCardClick = (card) => {
    console.log("Clicked card rarity:", card.rarity);
    setSelectedCard(card);
    setShowBoxInfo(false);
    setBoxCardsDetails([]);
    if (card.rarity === "lootbox") {
      const rarityChances = {
        Обычная: card["Обычная"] ?? 0,
        Редкая: card["Редкая"] ?? 0,
        Эпическая: card["Эпическая"] ?? 0,
        Легендарная: card["Легендарная"] ?? 0,
      };

      if (boxContentsCache.current[card.id]) {
        setBoxCardsDetails(boxContentsCache.current[card.id]);
      } else {
        fetchBoxCardsDetails(card.id, rarityChances);
      }
    }
  };

  return (
    <div className="shop-page">
      <div className="tabs">
        <button
          className={`tab ${activeTab === "shop" ? "active" : ""}`}
          onClick={() => handleTabChange("shop")}
        >
          Поставщик
        </button>
        <button
          className={`tab ${activeTab === "market" ? "active" : ""}`}
          onClick={() => handleTabChange("market")}
        >
          Аукцион
        </button>
      </div>

      <div className="market-container">
        {activeTab === "shop" && (
          <div className="sort-refresh-container">
            <button
              onClick={fetchCards}
              disabled={isLoading}
              className="refresh-button"
            >
              {isLoading ? "Загрузка..." : "Обновить"}{" "}
              <RefreshIcon fontSize="small" />
            </button>
            <Select
              value={sortCriterion}
              onChange={(e) => setSortCriterion(e.target.value)}
              className="sort-select"
              IconComponent={ArrowDropDownIcon}
              sx={{
                color: "#ffa500",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#ffa500",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#ffa500",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#ffa500",
                  boxShadow: "0 0 5px #ffa500",
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: { backgroundColor: "#2e2e2e", color: "#ffa500" },
                },
              }}
            >
              {sortOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.icon}
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {activeTab === "shop" && (
          <>
            {lootboxes.length > 0 && (
              <div className="card-category">
                <h2 className="category-title">Ланч-боксы</h2>
                <div className="grid">
                  {lootboxes.map((box) => (
                    <FramedCard
                      key={box.id}
                      card={{
                        name: box.name || "Ланч-Загадочный",
                        image_url: box.image_url,
                        rarity: "lootbox",
                        quantity: box.quantity ?? 1,
                      }}
                      onClick={() =>
                        handleCardClick({
                          ...box,
                          rarity: "lootbox",
                          card_id: box.id,
                          description:
                            box.description ?? "Содержит случайные карты",
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {Object.entries(groupedCards).map(([key, cards]) =>
              cards.length > 0 ? (
                <div key={key} className="card-category">
                  <h2 className="category-title">{categoryNames[key]}</h2>
                  <div className="grid">
                    {cards.map((card) => (
                      <FramedCard
                        key={card.card_id}
                        card={card}
                        showQuantityBadge={true}
                        rarityAccessLevel={rarityAccessLevel}
                        glowColor={getGlowColor(card)}
                        onClick={() =>
                          card.locked
                            ? handleLockedCardClick(card)
                            : handleCardClick(card)
                        }
                        quantityBadge={
                          <div className="card-quantity-badge">
                            {`${card.quantity}/${card.total_quantity}`}
                          </div>
                        }
                        className={`${card.locked ? "locked-card" : ""} ${
                          card.quantity <= 0 ? "locked-card" : ""
                        }`}
                        title={
                          card.locked
                            ? `Доступно с уровня ${
                                rarityAccessLevel[card.rarity] || 1
                              }`
                            : ""
                        }
                        onTouchStart={(e) => handleTouchStart(card, e)}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        onMouseDown={(e) => handleTouchStart(card, e)}
                        onMouseUp={handleTouchEnd}
                        onMouseLeave={handleTouchEnd}
                      />
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </>
        )}

        {activeTab === "market" && <Market setError={setError} />}

        {selectedCard && (
          <div
            className="overlay"
            onClick={() => setSelectedCard(null)} // клик по оверлею закрывает окно
          >
            <div
              className="overlay-content"
              onClick={(e) => e.stopPropagation()} // клики внутри окна не закрывают оверлей
            >
              <FramedCard
                card={selectedCard}
                showLevel={true}
                showQuantityBadge={false}
                glowColor={getGlowColor(selectedCard)}
              />

              <p>{selectedCard.description}</p>

              {selectedCard.rarity !== "lootbox" ? (
                <>
                  <div className="price-row">
                    <span>Цена: {selectedCard.price}</span>
                    <img src="/moneta.png" alt="coin" />
                  </div>

                  <div className="card-description">
                    Приоритет: {selectedCard.priority ?? "—"}
                    {selectedCard.damage &&
                      typeof selectedCard.damage === "number" && (
                        <div>Урон: {selectedCard.damage}</div>
                      )}
                    {Array.isArray(selectedCard.damage_over_time) &&
                      selectedCard.damage_over_time.length > 0 && (
                        <div>
                          Урон по ходам: (
                          {selectedCard.damage_over_time.join("-")})
                        </div>
                      )}
                    {selectedCard.damage_multiplier && (
                      <div>
                        Множитель урона: {selectedCard.damage_multiplier}
                      </div>
                    )}
                    {selectedCard.remove_multiplier && (
                      <div>
                        Удаление множителя: {selectedCard.remove_multiplier}
                      </div>
                    )}
                    {selectedCard.heal && (
                      <div>Лечение: {selectedCard.heal}</div>
                    )}
                  </div>

                  <label>
                    Кол-во:
                    <input
                      type="number"
                      min="1"
                      max={selectedCard.quantity}
                      value={purchaseAmount}
                      onChange={(e) =>
                        setPurchaseAmount(
                          Math.min(
                            Math.max(1, Number(e.target.value)),
                            selectedCard.quantity
                          )
                        )
                      }
                    />
                  </label>

                  <div>
                    Доступно:{" "}
                    {selectedCard.quantity > 0
                      ? selectedCard.quantity
                      : "Нет в наличии"}
                  </div>

                  <button
                    className="buy-btn"
                    disabled={
                      selectedCard.locked ||
                      selectedCard.quantity <= 0 ||
                      purchaseAmount <= 0
                    }
                    onClick={handlePurchaseClick}
                  >
                    {isConfirmingPurchase ? (
                      <>
                        Итоговая цена: {selectedCard.price * purchaseAmount}{" "}
                        <img
                          src="/moneta.png"
                          alt="coin"
                          style={{
                            width: 16,
                            verticalAlign: "middle",
                            marginLeft: 4,
                          }}
                        />
                      </>
                    ) : (
                      "Купить"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="card-description">
                    <button
                      className="info-btn"
                      onClick={() => setShowBoxInfo(!showBoxInfo)}
                      disabled={loadingBoxCards}
                      aria-label={
                        showBoxInfo
                          ? "Скрыть содержимое"
                          : "Показать содержимое"
                      }
                    >
                      <InfoIcon />
                    </button>

                    {(showBoxInfo || boxInfoVisible) && (
                      <div
                        className={`box-contents ${
                          boxInfoVisible ? "show" : ""
                        } ${isHidingBoxInfo ? "hiding" : ""}`}
                      >
                        <h4>Содержимое коробки:</h4>
                        {loadingBoxCards ? (
                          <div>Загрузка...</div>
                        ) : boxCardsDetails.length === 0 ? (
                          <div>Нет данных</div>
                        ) : (
                          <ul>
                            {boxCardsDetails.map((card) => (
                              <li key={card.card_id}>
                                {card.name} ({card.rarity}): {card.chance}%
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Новая кнопка покупки коробки */}
                  <button
                    className="buy-btn"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, "users", uid);
                        const userSnap = await getDoc(userRef);

                        if (!userSnap.exists()) {
                          setError("Пользователь не найден");
                          return;
                        }

                        const userData = userSnap.data();
                        const balance = userData.balance || 0;

                        if (balance < selectedCard.price) {
                          setError("Недостаточно средств для покупки");
                          return;
                        }

                        // Списываем средства
                        await updateDoc(userRef, {
                          balance: balance - selectedCard.price,
                        });

                        // Навигация на страницу открытия бокса
                        navigate("/open-box", {
                          state: { boxId: selectedCard.card_id },
                        });
                      } catch (err) {
                        console.error("Ошибка при покупке бокса:", err);
                        setError("Ошибка при обработке покупки");
                      }
                    }}
                    disabled={selectedCard.price <= 0}
                    style={{ marginTop: "16px" }}
                  >
                    Купить за {selectedCard.price}
                    <img
                      src="/moneta.png"
                      alt="coin"
                      style={{
                        width: 16,
                        verticalAlign: "middle",
                        marginLeft: 4,
                      }}
                    />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {lockedTooltip && <div className="locked-tooltip">{lockedTooltip}</div>}
        <CardTooltip card={tooltipCard} position={tooltipPosition} />
      </div>
    </div>
  );
}
export default ShopPage;
