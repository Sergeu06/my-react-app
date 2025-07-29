import { doc, getDoc } from 'firebase/firestore';
import { ref, get, set } from 'firebase/database';
import { db, database } from '../firebase';
import getPlayerDeck from './utils/getPlayerDeck';
import getRandomCards from './utils/getRandomCards';

const START_HAND_SIZE = 2;

const initGame = async (uid, opponentUid, lobbyId) => {
  try {
    const gameRef = ref(database, `games/${lobbyId}`);
    const gameSnap = await get(gameRef);

    if (gameSnap.exists()) {
      // Игра уже началась
      return gameSnap.val();
    }

    // Получаем профили
    const [playerDoc, opponentDoc] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'users', opponentUid)),
    ]);

    if (!playerDoc.exists() || !opponentDoc.exists()) {
      throw new Error('Профиль игрока не найден');
    }

    const player = playerDoc.data();
    const opponent = opponentDoc.data();

    // Получаем колоды
    const [playerDeckRaw, opponentDeckRaw] = await Promise.all([
      getPlayerDeck(uid),
      getPlayerDeck(opponentUid),
    ]);

    // Добираем карты для руки и остаток колоды
    const { drawnCards: playerHand, remainingDeck: playerDeck } = getRandomCards(playerDeckRaw, START_HAND_SIZE);
    const { drawnCards: opponentHand, remainingDeck: opponentDeck } = getRandomCards(opponentDeckRaw, START_HAND_SIZE);

    const initialGameState = {
      state: 'playing',
      turn: 1,
      players: {
        [uid]: {
          uid,
          nickname: player.nickname || 'Игрок 1',
          hp: 100,
          hand: playerHand,
          deck: playerDeck,
          graveyard: [],
          recipes: 5, 
        },
        [opponentUid]: {
          uid: opponentUid,
          nickname: opponent.nickname || 'Игрок 2',
          hp: 100,
          hand: opponentHand,
          deck: opponentDeck,
          graveyard: [],
          recipes: 5, 
        },
      },
    };
    

    await set(gameRef, initialGameState);

    return initialGameState;
  } catch (error) {
    console.error('Ошибка инициализации боя:', error);
    return null;
  }
};

export default initGame;
