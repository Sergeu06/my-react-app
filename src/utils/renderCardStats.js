export function renderCardStats(card) {
  if (!card) return [];

  const bonus = card.bonus || {};
  const stats = [];

  if (card.damage !== undefined) {
    stats.push({
      label: `Урон:`,
      value: card.damage + (bonus.damage || 0),
      type: "damage",
    });
  }

  if (
    Array.isArray(card.damage_over_time) &&
    card.damage_over_time.length > 0
  ) {
    stats.push({
      label: `Урон по ходам:`,
      value: `(${card.damage_over_time.join("-")})`,
      type: "damage_over_time",
    });
  }

  if (card.heal !== undefined) {
    stats.push({
      label: `Лечение:`,
      value: card.heal + (bonus.heal || 0),
      type: "heal",
    });
  }

  if (card.damage_multiplier !== undefined) {
    const total = (
      card.damage_multiplier + (bonus.damage_multiplier || 0)
    ).toFixed(2);
    stats.push({
      label: `Множитель урона:`,
      value: `x${total}`,
      type: "damage_multiplier",
    });
  }

  if (card.remove_multiplier) {
    stats.push({ label: `Удаляет множитель`, type: "remove_multiplier" });
  }

  return stats;
}
