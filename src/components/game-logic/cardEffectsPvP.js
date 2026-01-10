// game-logic/cardEffectsPvP.js
import { ref, get, set } from "firebase/database";
import { database } from "../firebase";

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// =========================
// Damage Multiplier (fixed 3 turns; stored as factor)
// =========================

// =========================
// Damage Multiplier (3 turns; additive stacking of (value - 1))
// =========================

export function addDamageMultiplierEffectPvP(
  damageMultiplierEffect,
  newFactor // например 1.25, 2.10 и т.д.
) {
  if (typeof newFactor !== "number" || isNaN(newFactor)) {
    return damageMultiplierEffect ?? null;
  }

  // выделяем дельту от 1
  const delta = newFactor - 1;

  // уже накопленная дельта
  const existingDelta = damageMultiplierEffect?.delta ?? 0;

  return {
    // суммируем только дельты
    delta: existingDelta + delta,
    // итоговый коэффициент
    multiplier: 1 + existingDelta + delta,
    turnsLeft: 3,
    id: damageMultiplierEffect?.id ?? generateId(),
  };
}

export function applyDamageMultiplierPvP(damageMultiplierEffect, card) {
  if (!card || typeof card.damage_multiplier !== "number") {
    return damageMultiplierEffect ?? null;
  }
  const factor = card.damage_multiplier; // например 1.25 или 2.1
  if (!isFinite(factor) || factor <= 0) return damageMultiplierEffect ?? null;

  return addDamageMultiplierEffectPvP(damageMultiplierEffect, factor);
}

// =========================
// Общая функция рассчёта урона
// =========================

function calcEffectiveDamage(baseDamage, effect) {
  const multiplier = effect?.multiplier ?? 1;
  return Math.max(1, Math.round(baseDamage * multiplier));
}

// =========================
// Healing
// =========================
export async function applyHealPvP(targetUid, card, lobbyId) {
  if (!targetUid || !lobbyId || !card) return null;

  const healValue = Number(card.heal);
  if (!isFinite(healValue) || healValue <= 0) return null;

  const hpRef = ref(database, `lobbies/${lobbyId}/hp/${targetUid}`);
  const maxHpRef = ref(database, `lobbies/${lobbyId}/maxHp/${targetUid}`);

  const [hpSnap, maxHpSnap] = await Promise.all([get(hpRef), get(maxHpRef)]);
  const currentHp = hpSnap.val() ?? 100;
  const maxHp = maxHpSnap.val() ?? 100;

  const newHp = Math.min(maxHp, currentHp + healValue);

  console.log("[applyHealPvP]", { healValue, currentHp, maxHp, newHp });

  await set(hpRef, newHp);
  return newHp;
}

// =========================
// Instant Damage
// =========================

export async function applyDamagePvP(
  targetUid,
  card,
  damageMultiplierEffect,
  lobbyId
) {
  if (!targetUid || !lobbyId || !card) return null;

  if (
    !("damage" in card) &&
    !("attack" in card) &&
    Array.isArray(card.damage_over_time)
  ) {
    return null;
  }

  const hpRef = ref(database, `lobbies/${lobbyId}/hp/${targetUid}`);
  const snap = await get(hpRef);
  const currentHp = snap.val() ?? 0;

  const baseDamage =
    typeof card.damage === "number"
      ? card.damage
      : typeof card.attack === "number"
      ? card.attack
      : 0;

  const multiplier = damageMultiplierEffect?.multiplier ?? 1;
  const effectiveDamage = Math.max(1, Math.round(baseDamage * multiplier));
  const newHp = Math.max(0, currentHp - effectiveDamage);

  console.log("[applyDamagePvP]", {
    baseDamage,
    multiplier,
    effectiveDamage,
    newHp,
  });

  await set(hpRef, newHp);
  return newHp;
}

// =========================
// DOT (damage over time)
// =========================
export async function applyDotPvP(
  targetUid,
  card,
  turnIndex,
  lobbyId,
  damageMultiplierEffect = null
) {
  if (!targetUid || !lobbyId || !card) return null;
  if (!Array.isArray(card.damage_over_time)) return null;

  // 🔒 Фиксируем момент активации DoT (первый тик)
  if (turnIndex === 0 && card.dotActivated !== true) {
    card.dotActivated = true;
  }

  const baseDamage = Number(card.damage_over_time[turnIndex]) || 0;
  if (baseDamage <= 0) return null;

  const multiplier = damageMultiplierEffect?.multiplier ?? 1;
  const effectiveDamage = Math.max(1, Math.round(baseDamage * multiplier));

  const hpRef = ref(database, `lobbies/${lobbyId}/hp/${targetUid}`);
  const snap = await get(hpRef);
  const currentHp = snap.val() ?? 0;

  const newHp = Math.max(0, currentHp - effectiveDamage);
  await set(hpRef, newHp);

  console.log("[applyDotPvP]", {
    baseDamage,
    multiplier,
    effectiveDamage,
    currentHp,
    newHp,
    turnIndex,
  });

  return newHp;
}
