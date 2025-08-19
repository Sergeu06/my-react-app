// Заглушка розыгрыша карты

export default function playCardLogic({ hand, playedCards, recipes, cardToPlay }) {
    // Проверим, хватает ли ресурсов
    if (recipes < (cardToPlay.cost || 0)) {
      throw new Error("Недостаточно ресурсов!");
    }
  
    // Убираем карту из руки
    const newHand = hand.filter((c) => c.id !== cardToPlay.id);
  
    // Добавляем карту в список разыгранных
    const newPlayed = [...playedCards, cardToPlay];
  
    // Списываем стоимость
    const newRecipes = recipes - (cardToPlay.cost || 0);
  
    return { hand: newHand, playedCards: newPlayed, recipes: newRecipes };
  }
  