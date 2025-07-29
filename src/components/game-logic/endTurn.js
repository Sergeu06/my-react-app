import { ref, get, set, update, onValue, off } from 'firebase/database';
import { database } from '../firebase';

const MAX_RECIPES = 10;
const RECIPES_PER_TURN = 2;
const TURN_TIMEOUT = 30000; // 30 секунд

const endTurn = async (uid, lobbyId) => {
  const turnRef = ref(database, `lobbies/${lobbyId}/turns/${uid}`);
  await set(turnRef, true);

  const otherTurnRef = ref(database, `lobbies/${lobbyId}/turns`);
  const cleanupAndNextTurn = async () => {
    const gameRef = ref(database, `games/${lobbyId}`);
    const gameSnap = await get(gameRef);

    if (!gameSnap.exists()) return;
    const game = gameSnap.val();
    const updatedPlayers = {};

    for (const playerId in game.players) {
      const player = game.players[playerId];
      const currentRecipes = player.recipes || 0;
      const newRecipes = Math.min(currentRecipes + RECIPES_PER_TURN, MAX_RECIPES);
      updatedPlayers[`players/${playerId}/recipes`] = newRecipes;
    }

    updatedPlayers['turn'] = (game.turn || 1) + 1;

    // Очищаем флаги завершения хода
    await update(gameRef, updatedPlayers);
    await set(ref(database, `lobbies/${lobbyId}/turns`), {});
  };

  const listener = onValue(otherTurnRef, async (snapshot) => {
    const turns = snapshot.val();
    if (!turns) return;

    const allReady = Object.values(turns).filter(Boolean).length >= 2;

    if (allReady) {
      off(otherTurnRef, 'value', listener);
      await cleanupAndNextTurn();
    }
  });

  // Устанавливаем таймер на 30 секунд
  setTimeout(async () => {
    const current = (await get(otherTurnRef)).val() || {};
    if (Object.values(current).filter(Boolean).length < 2) {
      // Принудительно завершаем ход второго игрока
      const opponentUid = Object.keys(current).find(key => key !== uid);
      if (opponentUid && !current[opponentUid]) {
        await set(ref(database, `lobbies/${lobbyId}/turns/${opponentUid}`), true);
      }

      off(otherTurnRef, 'value', listener);
      await cleanupAndNextTurn();
    }
  }, TURN_TIMEOUT);
};

export default endTurn;
