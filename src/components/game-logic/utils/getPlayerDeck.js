import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default async function getPlayerDeck(uid) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  if (!userSnap.exists() || !userData.deck) {
    throw new Error(`Не удалось загрузить колоду игрока ${uid}`);
  }

  return userData.deck;
}
