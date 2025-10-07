import React from "react";
import { toRoman } from "../utils/toRoman";

const rarityFrameMap = {
  обычная: "/frames/common.png",
  common: "/frames/common.png",

  редкая: "/frames/rare.png",
  rare: "/frames/rare.png",

  эпическая: "/frames/epic.png",
  epic: "/frames/epic.png",

  легендарная: "/frames/legend.png",
  legendary: "/frames/legend.png",

  lootbox: "/frames/lootbox.png",
  box: "/frames/lootbox.png",
};

function normalizeRarity(rarity) {
  if (!rarity) return "обычная";
  const lower = rarity.toLowerCase();

  if (lower.includes("легенд")) return "легендарная";
  if (lower.includes("эпич")) return "эпическая";
  if (lower.includes("редк")) return "редкая";
  if (lower.includes("comm") || lower.includes("обыч")) return "обычная";
  if (lower.includes("box") || lower.includes("loot")) return "lootbox";

  return lower;
}

function getGlowColor(card) {
  if (card.damage) return "#ff4d4d"; // красный
  if (Array.isArray(card.damage_over_time) && card.damage_over_time.length > 0)
    return "#ff8800";
  if (card.damage_multiplier) return "#cc00cc"; // фиолетовый
  if (card.remove_multiplier) return "#00cccc"; // бирюзовый
  if (card.heal) return "#33cc33"; // зелёный
  return "transparent"; // по умолчанию
}

function FramedCard({
  card,
  rarityAccessLevel = {},
  onClick,
  quantityBadge = null,
  showQuantityBadge = false,
  showLevel = false,
  showPriority = false, // 👈 Новый флаг
  glowColor = null,
  showName = true,
}) {
  const normalizedRarity = normalizeRarity(card.rarity);
  const frameSrc =
    rarityFrameMap[normalizedRarity] || rarityFrameMap["обычная"];

  const color = glowColor || getGlowColor(card);

  return (
    <div
      className="card-frame-wrapper"
      onClick={onClick}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {showLevel && card.lvl && (
        <div className="card-level-overlay">{toRoman(card.lvl)}</div>
      )}

      {showPriority && card.priority && (
        <div className="card-priority-overlay">{card.priority}</div>
      )}

      <img src={frameSrc} alt="Рамка" className="card-border-frame" />
      <div
        className={`framed-container ${
          card.quantity <= 0 || card.locked ? "inactive-card" : ""
        } ${!showName ? "no-name" : ""}`}
        style={{ "--card-glow-color": color }}
        title={
          card.locked
            ? `Доступно с уровня ${rarityAccessLevel[normalizedRarity] || 1}`
            : ""
        }
      >
        {showQuantityBadge &&
          (quantityBadge || <div className="card-quantity-badge" />)}

        {showName && <div className="card-name">{card.name}</div>}
        <img src={card.image_url} alt={card.name} className="card-image" />
      </div>
    </div>
  );
}

export default FramedCard;
export { getGlowColor };
