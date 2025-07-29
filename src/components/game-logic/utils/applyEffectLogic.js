export function applyEffectLogic(state, playerId, card) {
  const opponentId = playerId === 1 ? 2 : 1;
  const newPlayers = { ...state.players };

  switch (card.effect.type) {
    case 'damage':
      newPlayers[opponentId].health -= card.effect.value;
      break;
    case 'heal':
      newPlayers[playerId].health += card.effect.value;
      break;
    // другие эффекты могут быть добавлены здесь
    default:
      break;
  }

  return { ...state, players: newPlayers };
}
