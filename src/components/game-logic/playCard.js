export default function playCard({ hand, playedCards, recipes, cardToPlay }) {
    if (recipes < cardToPlay.cost) {
      throw new Error('Недостаточно рицептов');
    }
    // Удаляем карту из руки
    const newHand = hand.filter(card => card.id !== cardToPlay.id);
    // Добавляем карту на стол
    const newPlayedCards = [...playedCards, cardToPlay];
    // Тратим рицепты
    const newRecipes = recipes - cardToPlay.cost;
  
    return {
      hand: newHand,
      playedCards: newPlayedCards,
      recipes: newRecipes,
    };
  }
  