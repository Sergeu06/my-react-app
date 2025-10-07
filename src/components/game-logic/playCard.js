// Заглушка розыгрыша карты
export default function playCardLogic({
  hand,
  playedCards,
  recipes,
  cardToPlay,
}) {
  const cost = cardToPlay.cost ?? cardToPlay.value ?? 0;

  if (recipes < cost) {
    throw new Error("Недостаточно ресурсов!");
  }

  const newHand = hand.filter((c) => c.id !== cardToPlay.id);
  const newPlayed = [...playedCards, cardToPlay];
  const newRecipes = recipes - cost;

  return { hand: newHand, playedCards: newPlayed, recipes: newRecipes };
}
