import React from "react";
import FramedCard from "../utils/FramedCard"; // путь подкорректируйте под ваш проект

function MarketModal({
  card,
  onClose,
  onPurchase,
  onRemove,
  actionInProgress,
  currentUid,
}) {
  if (!card) return null;

  const { cardDetails, price, sellerName } = card;

  const renderCardSpecialEffect = (details) => {
    if (!details) return null;
    const bonus = details.bonus || {};
    const stats = [];

    if (details.damage !== undefined) {
      stats.push(`Урон: ${details.damage + (bonus.damage || 0)}`);
    }

    // Новый параметр damage_over_time
    if (
      Array.isArray(details.damage_over_time) &&
      details.damage_over_time.length > 0
    ) {
      stats.push(`Урон по ходам: (${details.damage_over_time.join("-")})`);
    }

    if (details.heal !== undefined) {
      stats.push(`Лечение: ${details.heal + (bonus.heal || 0)}`);
    }
    if (details.damage_multiplier !== undefined) {
      const total = (
        details.damage_multiplier + (bonus.damage_multiplier || 0)
      ).toFixed(2);
      stats.push(`Множитель урона: x${total}`);
    }
    if (details.remove_multiplier) {
      stats.push(`Удаляет множитель`);
    }

    return stats.map((line, idx) => <div key={idx}>{line}</div>);
  };

  return (
    <div className="modal">
      <div className="overlay-content">
        <FramedCard
          card={cardDetails}
          size="large" // если поддерживается размер
          showLevel={true} // отображать уровень, как в инвентаре
        />
        <div>
          <br />
          <strong>Флот:</strong> {cardDetails?.fleet || "—"}
        </div>
        <div>
          <strong>Приоритет:</strong> {cardDetails?.priority ?? "—"}
        </div>
        <div>
          <strong>Редкость:</strong> {cardDetails?.rarity || "—"}
        </div>
        <div>
          <strong>Уровень:</strong> {cardDetails?.lvl ?? "—"}
        </div>

        {renderCardSpecialEffect(cardDetails)}

        <div className="price-row">
          <span>Цена: {price}</span>
          <img src="/moneta.png" alt="coin" />
        </div>
        <div>Продавец: {sellerName || "Неизвестный"}</div>

        {cardDetails?.owner === currentUid ? (
          <button onClick={onRemove} disabled={actionInProgress}>
            {actionInProgress ? "Снятие..." : "Снять с продажи"}
          </button>
        ) : (
          <button onClick={onPurchase} disabled={actionInProgress}>
            {actionInProgress ? "Покупка..." : "Купить"}
          </button>
        )}
        <button onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

export default MarketModal;
