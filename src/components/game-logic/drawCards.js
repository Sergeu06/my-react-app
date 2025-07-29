import getRandomCards from './utils/getRandomCards';

export default function drawCards(deck, handSize = 2) {
  const { drawnCards, remainingDeck } = getRandomCards(deck, handSize);
  return {
    hand: drawnCards,
    deck: remainingDeck,
  };
}
