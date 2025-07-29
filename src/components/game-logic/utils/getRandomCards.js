export default function getRandomCards(deck, count) {
  const array = [...deck];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  const drawnCards = array.slice(0, count);
  const remainingDeck = array.slice(count);
  return { drawnCards, remainingDeck };
}
