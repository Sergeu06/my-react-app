export const buildLootboxChances = (
  boxCards,
  rarityChances,
  rarityCountMap
) =>
  boxCards.map((card) => {
    const rarityKey =
      card.rarity.charAt(0).toUpperCase() +
      card.rarity.slice(1).toLowerCase();

    const totalChance = rarityChances[rarityKey] || 0;
    const count = rarityCountMap[card.rarity] || 1;
    const chance = (totalChance / count).toFixed(2);

    return { ...card, chance };
  });
