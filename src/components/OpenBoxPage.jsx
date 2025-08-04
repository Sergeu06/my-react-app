import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { db, database } from "./firebase";

import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { set, ref as databaseRef } from "firebase/database";
import "./OpenBoxPage.css";

function OpenBoxPage({ uid }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { boxId } = location.state || {};

  const [clickStep, setClickStep] = useState(0);
  const [resultCard, setResultCard] = useState(null);
  const [isOpening, setIsOpening] = useState(true);
  const [dropChance, setDropChance] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const addCardToInventory = async () => {
      if (!resultCard || !uid) return;

      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) throw new Error("Пользователь не найден");

        const originalCardRef = doc(
          db,
          "cards",
          resultCard.card_id || resultCard.id
        );
        const originalCardSnap = await getDoc(originalCardRef);
        if (!originalCardSnap.exists())
          throw new Error("Оригинальная карта не найдена");

        const cardData = originalCardSnap.data();

        // Создаем новую карту в Realtime Database
        const newId = crypto.randomUUID();

        await set(databaseRef(database, `cards/${newId}`), {
          ...cardData,
          lvl: 1,
          owner: uid,
          fleet: parseFloat(Math.random().toFixed(10)),
          sell: false,
          original_id: resultCard.card_id || resultCard.id,
          upgradeBonus: 0,
          increase: cardData.increase ?? 1,
        });

        // Добавляем ID карты в массив пользователя
        await updateDoc(userRef, {
          cards: arrayUnion(newId),
        });

        console.log(
          `✅ Карта "${cardData.name}" добавлена в инвентарь пользователя.`
        );
      } catch (err) {
        console.error("[Лутбокс] Ошибка добавления карты в инвентарь:", err);
      }
    };

    addCardToInventory();
  }, [resultCard, uid]);

  const openBox = useCallback(async () => {
    try {
      const boxDoc = await getDoc(doc(db, "box", boxId));
      const boxData = boxDoc.data();
      const cardIds = boxData.cards || [];

      if (cardIds.length === 0) {
        setResultCard(null);
        setIsOpening(false);
        setClickStep(2);
        return;
      }

      const cardsData = [];
      for (const cardId of cardIds) {
        const cardSnap = await getDoc(doc(db, "cards", cardId));
        const cardData = cardSnap.data();
        if (cardData) {
          cardsData.push({ id: cardId, ...cardData });
        }
      }

      const rarities = ["Обычная", "Редкая", "Эпическая", "Легендарная"];
      const cardsByRarity = {};
      for (const rarity of rarities) {
        cardsByRarity[rarity] = cardsData.filter((c) => c.rarity === rarity);
      }

      const rarityChances = {
        Обычная: boxData.Обычная || 0,
        Редкая: boxData.Редкая || 0,
        Эпическая: boxData.Эпическая || 0,
        Легендарная: boxData.Легендарная || 0,
      };

      const cardChances = {};
      for (const rarity of rarities) {
        const pool = cardsByRarity[rarity] || [];
        const perCardChance =
          pool.length > 0 ? rarityChances[rarity] / pool.length : 0;

        for (const card of pool) {
          cardChances[card.id] = perCardChance;
        }
      }

      // 🎯 Логи
      console.log("🎯 Все шансы на выпадение по картам:");
      for (const card of cardsData) {
        const chance = cardChances[card.id] ?? 0;
        console.log(
          `- ${card.name} (${card.rarity}): ${chance.toFixed(2)}% (ID: ${
            card.id
          })`
        );
      }

      const totalWeight = Object.values(rarityChances).reduce(
        (a, b) => a + b,
        0
      );
      const rand = Math.random() * totalWeight;

      let selectedRarity = null;
      let cumulative = 0;
      for (const rarity of rarities) {
        cumulative += rarityChances[rarity];
        if (rand <= cumulative) {
          selectedRarity = rarity;
          break;
        }
      }

      const selectedPool = cardsByRarity[selectedRarity] || [];
      if (selectedPool.length === 0) {
        setResultCard(null);
        setIsOpening(false);
        setClickStep(2);
        return;
      }

      const selectedCard =
        selectedPool[Math.floor(Math.random() * selectedPool.length)];
      setResultCard(selectedCard);
      setDropChance(cardChances[selectedCard.id]?.toFixed(2));

      // 🎯 Предзагрузка изображения
      const img = new Image();
      img.src = selectedCard.image_url;
      img.onload = () => {
        setTimeout(() => {
          setIsReady(true); // Разрешаем клик
          setLoading(false); // Убираем флаг загрузки
        }, 300); // ⏱ Плавный переход, можно настроить
      };
    } catch (err) {
      console.error("Ошибка при открытии коробки:", err);
    }
  }, [boxId]);

  useEffect(() => {
    if (!boxId) {
      navigate(`/shop?start=${uid}`);
      return;
    }
    openBox();
  }, [boxId, navigate, uid, openBox]);

  useEffect(() => {
    const handleClick = () => {
      if (!isReady) return; // ⛔ Нельзя кликать до загрузки

      if (clickStep === 0) {
        setClickStep(1);
        setIsOpening(false); // ⬅ крышка начинает анимацию
        setCardVisible(true); // ⬅ карта появляется параллельно
      } else if (clickStep === 1) {
        setClickStep(2);
      } else if (clickStep === 2) {
        navigate(`/shop?start=${uid}`);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [clickStep, navigate, uid, isReady]);

  return (
    <div className="open-box-page">
      <h2>Открытие коробки</h2>
      <div className={`box-container ${loading ? "loading" : ""}`}>
        {resultCard && (
          <div
            className={`rarity-glow ${
              resultCard.rarity === "Обычная"
                ? "rarity-common"
                : resultCard.rarity === "Редкая"
                ? "rarity-rare"
                : resultCard.rarity === "Эпическая"
                ? "rarity-epic"
                : resultCard.rarity === "Легендарная"
                ? "rarity-legendary"
                : ""
            }`}
          />
        )}

        <img src="/images/plate.png" className="plate" alt="plate" />
        <div className={`card-reveal ${cardVisible ? "visible" : ""}`}>
          {resultCard && (
            <img
              src={resultCard.image_url}
              alt={resultCard.name}
              className="card-image"
            />
          )}
        </div>

        <img
          src="/images/lid.png"
          className={`lid ${!isOpening ? "open" : ""}`}
          alt="lid"
        />
      </div>

      {!isOpening && resultCard && (
        <div className="result-text">
          <h3 style={{ color: "#ccc" }}>Вы получили:</h3>
          <p style={{ color: "#ff9f00" }}>{resultCard.name}</p>
          <p style={{ fontSize: "14px", color: "#888" }}>
            (шанс: {dropChance || "?"}%)
          </p>
        </div>
      )}
    </div>
  );
}

export default OpenBoxPage;
