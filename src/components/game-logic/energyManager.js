// game-logic/energyManager.js
import { databaseRef, get, set } from "../firebase";

// Максимум энергии
export const MAX_RECIPES = 25;

// Получение текущей энергии игрока
export async function getEnergy(database, lobbyId, uid) {
  const energyRef = databaseRef(database, `lobbies/${lobbyId}/energy/${uid}`);
  const snap = await get(energyRef);
  return snap.exists() ? snap.val() : 0;
}

// Установка энергии
export async function setEnergy(database, lobbyId, uid, value) {
  const clamped = Math.min(MAX_RECIPES, Math.max(0, value));
  await set(
    databaseRef(database, `lobbies/${lobbyId}/energy/${uid}`),
    clamped
  );
  return clamped;
}

// Добавление энергии (например +2 в начале раунда)
export async function addEnergy(database, lobbyId, uid, value) {
  const current = await getEnergy(database, lobbyId, uid);
  const newEnergy = await setEnergy(database, lobbyId, uid, current + value);
  console.log(
    `[Energy] ${uid} получил +${value}. Текущее: ${newEnergy}/${MAX_RECIPES}`
  );
  return newEnergy;
}

// Трата энергии (при розыгрыше карты)
export async function spendEnergy(database, lobbyId, uid, cost) {
  const current = await getEnergy(database, lobbyId, uid);
  if (current < cost) {
    console.warn(
      `[Energy] Недостаточно энергии для ${uid}: ${current}/${cost}`
    );
    return false; // не хватает энергии
  }
  const newEnergy = await setEnergy(database, lobbyId, uid, current - cost);
  console.log(
    `[Energy] ${uid} потратил ${cost}. Осталось: ${newEnergy}/${MAX_RECIPES}`
  );
  return true;
}
