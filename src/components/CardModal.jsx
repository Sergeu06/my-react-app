import React, { useState, useRef, useEffect } from "react";
import { doc, getDoc, updateDoc, databaseRef, set, update } from "./firebase";
import FramedCard from "../utils/FramedCard";

function CardModal({
  card,
  onClose,
  addNotification,
  playerCards,
  setPlayerCards,
  deck1,
  setDeck1,
  deck2,
  setDeck2,
  uid,
  db,
  database,
}) {
  const [price, setPrice] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [sellerAmount, setSellerAmount] = useState("");
  const [isSellingMode, setIsSellingMode] = useState(false);
  const isListing = useRef(false);

  useEffect(() => {
    const normalized = price.replace(",", ".");
    const numeric = parseFloat(normalized);
    if (!isNaN(numeric) && numeric > 0) {
      setFinalPrice(numeric.toFixed(2));
      setSellerAmount((numeric * 0.92).toFixed(2));
    } else {
      setFinalPrice("");
      setSellerAmount("");
    }
  }, [price]);

  const handlePriceChange = (e) => {
    let val = e.target.value.replace(",", ".");
    if (val === "" || /^\d+(\.\d{0,2})?$/.test(val)) {
      setPrice(val);
    }
  };

  const removeCardFromAll = (cardId) => {
    setPlayerCards((prev) => prev.filter((c) => c.id !== cardId));
    setDeck1((prev) => prev.filter((c) => c.id !== cardId));
    setDeck2((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleConfirmListing = async () => {
    if (isListing.current) return;

    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      addNotification("Введите корректную цену.", "error");
      return;
    }

    if (!card) {
      addNotification("Карта не выбрана.", "error");
      return;
    }

    isListing.current = true;

    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const nickname = userData.nickname || "Без имени";

      // Записываем карту в маркет
      const marketRef = databaseRef(database, `market/${card.id}`);
      await set(marketRef, {
        price: parseFloat(price),
        sellerName: nickname,
        id: card.id,
        owner: uid,
        name: card.name,
        image_url: card.image_url,
        rarity: card.rarity,
        timestamp: Date.now(),
      });

      // Отмечаем карту как продаваемую
      const cardRef = databaseRef(database, `cards/${card.id}`);
      await update(cardRef, { sell: true });

      // Удаляем из Firestore
      const updatedCards = (userData.cards || []).filter(
        (id) => id !== card.id
      );
      const updatedPvp = (userData.deck_pvp || []).filter(
        (id) => id !== card.id
      );
      const updatedRaid = (userData.deck_raid || []).filter(
        (id) => id !== card.id
      );

      await updateDoc(doc(db, "users", uid), {
        cards: updatedCards,
        deck_pvp: updatedPvp,
        deck_raid: updatedRaid,
      });

      // Локально убираем карту из всех массивов
      removeCardFromAll(card.id);

      addNotification("Карта выставлена на продажу!", "success");
      setIsSellingMode(false);
      setPrice("");
      setFinalPrice("");
      setSellerAmount("");
      onClose();
    } catch (error) {
      console.error("Ошибка при выставлении карты:", error);
      addNotification("Не удалось выставить карту.", "error");
    } finally {
      isListing.current = false;
    }
  };

  const handleSell = async () => {
    const shopRef = doc(db, "shop", card.original_id);
    const shopSnap = await getDoc(shopRef);
    if (!shopSnap.exists()) {
      addNotification("Цена для этой карты не найдена.", "error");
      return;
    }

    const originalPrice = shopSnap.data().price;
    const sellPrice = parseFloat((originalPrice * 0.3).toFixed(2));
    const confirm = window.confirm(`Продать карту за ${sellPrice} ₽?`);
    if (!confirm) return;

    try {
      const cardRef = databaseRef(database, `cards/${card.id}`);
      await update(cardRef, { sold: true });

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};

      const updatedCards = (userData.cards || []).filter(
        (id) => id !== card.id
      );
      const updatedPvp = (userData.deck_pvp || []).filter(
        (id) => id !== card.id
      );
      const updatedRaid = (userData.deck_raid || []).filter(
        (id) => id !== card.id
      );

      await updateDoc(userRef, {
        cards: updatedCards,
        deck_pvp: updatedPvp,
        deck_raid: updatedRaid,
        balance: parseFloat((userData.balance || 0) + sellPrice),
      });

      removeCardFromAll(card.id);
      addNotification(`Карта продана за ${sellPrice} ₽`, "success");
      onClose();
    } catch (error) {
      console.error("Ошибка при продаже карты:", error);
      addNotification("Не удалось продать карту.", "error");
    }
  };

  const renderCardStats = (card) => {
    const stats = [];
    const bonus = card.bonus || {};

    if (card.damage !== undefined) {
      const total = card.damage + (bonus.damage || 0);
      stats.push(`Урон: ${total}`);
    }

    if (
      Array.isArray(card.damage_over_time) &&
      card.damage_over_time.length > 0
    ) {
      stats.push(`Урон по ходам: (${card.damage_over_time.join("-")})`);
    }

    if (card.heal !== undefined) {
      const total = card.heal + (bonus.heal || 0);
      stats.push(`Лечение: ${total}`);
    }

    if (card.damage_multiplier !== undefined) {
      const total = (
        card.damage_multiplier + (bonus.damage_multiplier || 0)
      ).toFixed(2);
      stats.push(`Множитель урона: x${total}`);
    }

    if (card.remove_multiplier) {
      stats.push(`Удаляет множитель`);
    }

    return stats;
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-content" onClick={(e) => e.stopPropagation()}>
        <FramedCard card={card} size="large" showLevel={true} />
        <div className="card-description">
          <br />
          Float: {card.fleet ?? "—"}
          <br />
          Энергия: {card.value ?? "—"}
          <br />
          Шаг прокачки: {card.increase ?? "—"}
          <br />
          Приоритет: {card.priority ?? "—"}
          <br />
          {renderCardStats(card).map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>

        {!isSellingMode ? (
          <>
            <button onClick={handleSell}>Продать за 30%</button>
            <button onClick={() => setIsSellingMode(true)}>
              Выставить на рынок
            </button>
          </>
        ) : (
          <>
            <label>
              Цена (₽):
              <input
                type="number"
                value={price}
                onChange={handlePriceChange}
                style={{ marginLeft: "8px", width: "80px" }}
                placeholder="0.00"
              />
            </label>

            {finalPrice && (
              <div style={{ marginTop: "6px" }}>
                После комиссии: <strong>{sellerAmount} ₽</strong> (8%)
              </div>
            )}

            <button onClick={handleConfirmListing} disabled={isListing.current}>
              Подтвердить продажу
            </button>

            <button onClick={onClose}>Отмена</button>
          </>
        )}
      </div>
    </div>
  );
}

export default CardModal;
