export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getRandomTurnsLeft() {
  return Math.floor(Math.random() * 5) + 2; // [2, 6]
}

// Добавление/обновление множителя урона
export function addDamageMultiplierEffect(
  damageMultiplierEffect,
  newMultiplierValue
) {
  if (damageMultiplierEffect) {
    return {
      ...damageMultiplierEffect,
      multiplier: damageMultiplierEffect.multiplier + newMultiplierValue,
      // Не трогаем turnsLeft — он уже уменьшился в начале хода!
    };
  } else {
    return {
      multiplier: newMultiplierValue,
      turnsLeft: getRandomTurnsLeft(),
      id: generateId(),
    };
  }
}

// Применение эффекта множителя урона от карты
export function applyDamageMultiplier(card, damageMultiplierEffect) {
  const base =
    typeof card.damage_multiplier === "number" ? card.damage_multiplier : 0;
  const bonus =
    typeof card.bonus?.damage_multiplier === "number"
      ? card.bonus.damage_multiplier
      : 0;
  const total = base + bonus;

  if (total > 0) {
    return addDamageMultiplierEffect(damageMultiplierEffect, total);
  }

  return damageMultiplierEffect;
}

// Урон по времени от карты (DoT)
export function applyDamageOverTime(
  card,
  bossHP,
  dotEffectsQueue,
  damageMultiplierEffect
) {
  if (
    !Array.isArray(card.damage_over_time) ||
    card.damage_over_time.length === 0
  ) {
    return { bossHP, newDotEffectsQueue: dotEffectsQueue };
  }

  const multiplier = damageMultiplierEffect
    ? damageMultiplierEffect.multiplier
    : 1;

  // Мгновенный урон от DoT (первый элемент)
  const immediateDamage = card.damage_over_time[0] || 0;
  const effectiveImmediate = Math.max(
    1,
    Math.round(immediateDamage * multiplier)
  );
  let newBossHP = Math.max(0, bossHP - effectiveImmediate);

  // Урон на следующие ходы с множителем, применённым сразу
  const newDotEffectsQueue = [...dotEffectsQueue];
  const futureDotDamages = card.damage_over_time.slice(1);

  futureDotDamages.forEach((damage, i) => {
    if (typeof damage === "number" && damage > 0) {
      newDotEffectsQueue.push({
        damage, // без множителя — это нормально
        turnsLeft: i + 1,
        id: generateId(),
      });
    }
  });
  return { bossHP: newBossHP, newDotEffectsQueue };
}

// Мгновенный урон
export function applyDamage(card, bossHP, damageMultiplierEffect) {
  if (typeof card.damage === "number" && card.damage > 0) {
    const multiplier = damageMultiplierEffect
      ? damageMultiplierEffect.multiplier
      : 1;
    const effectiveDamage = Math.max(1, Math.floor(card.damage * multiplier));
    return Math.max(0, bossHP - effectiveDamage);
  }
  return bossHP;
}

// Обработка эффектов DoT в начале хода
export function processDotEffects(
  bossHP,
  dotEffectsQueue,
  damageMultiplierEffect
) {
  // Считаем урон от DoT эффектов, у которых turnsLeft === 1 (эффекты, которые "срабатывают" в этом ходе)
  const currentTurnDotDamage = dotEffectsQueue
    .filter((effect) => effect.turnsLeft === 1)
    .reduce((sum, e) => sum + e.damage, 0);

  // Получаем множитель урона
  const multiplier = damageMultiplierEffect
    ? damageMultiplierEffect.multiplier
    : 1;

  // Рассчитываем итоговый урон с множителем
  const effectiveDotDamage = Math.max(
    0,
    Math.round(currentTurnDotDamage * multiplier)
  );

  // Наносим урон боссу
  const newBossHP = Math.max(0, bossHP - effectiveDotDamage);

  // Уменьшаем turnsLeft у всех эффектов, удаляем те, что закончились
  const updatedDotEffectsQueue = dotEffectsQueue
    .map((effect) => {
      const newTurnsLeft = effect.turnsLeft - 1;
      return { ...effect, turnsLeft: newTurnsLeft };
    })
    .filter((effect) => effect.turnsLeft > 0);

  // Обновляем множитель урона (уменьшаем оставшиеся ходы или удаляем)
  const updatedDamageMultiplierEffect = damageMultiplierEffect
    ? damageMultiplierEffect.turnsLeft > 1
      ? {
          ...damageMultiplierEffect,
          turnsLeft: damageMultiplierEffect.turnsLeft - 1,
        }
      : null
    : null;

  // Логируем для отладки
  console.log("Обновлённая очередь DoT:", updatedDotEffectsQueue);
  console.log(
    "Эффекты с turnsLeft === 1 (сработавшие):",
    dotEffectsQueue.filter((e) => e.turnsLeft === 1)
  );
  console.log("Урон от DoT в этом ходе (без множителя):", currentTurnDotDamage);
  console.log("Множитель урона:", multiplier);
  console.log("Итоговый урон от DoT:", effectiveDotDamage);

  return {
    bossHP: newBossHP,
    newDotEffectsQueue: updatedDotEffectsQueue,
    newDamageMultiplierEffect: updatedDamageMultiplierEffect,
    effectiveDotDamage,
  };
}

// Добор карты
export function drawNextCard(hand, deck) {
  if (deck.length === 0) return { hand, deck };
  const nextCard = deck[0];
  const newDeck = deck.slice(1);
  const newHand = [...hand, nextCard];
  return { hand: newHand, deck: newDeck };
}
