// Пример применения эффекта карты
export function applyCardEffect(state, card) {
  const opponentId = card.player === 1 ? 2 : 1;
  const player = state.players[card.player];
  const opponent = state.players[opponentId];

  switch (card.effect.type) {
    case 'damage':
      opponent.health -= card.effect.value;
      if (opponent.health < 0) opponent.health = 0;
      break;
    case 'heal':
      player.health += card.effect.value;
      if (player.health > 100) player.health = 100;
      break;
    // Добавь другие эффекты: дебафы, снятие дебафов и т.д.
    default:
      break;
  }
}
