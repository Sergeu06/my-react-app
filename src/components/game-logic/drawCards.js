// Добор карт из колоды (простейший вариант)

export default function drawCards(hand, deck) {
  const newHand = [...hand];
  const newDeck = [...deck];

  // пока в руке < 5 и в колоде есть карты, берём
  while (newHand.length < 4 && newDeck.length > 0) {
    newHand.push(newDeck.shift());
  }

  return { newHand, newDeck };
}
