import { getCardPriority } from './utils/getCardPriority';
import { applyCardEffect } from './applyCardEffect';

export function resolveTurn(state) {
  const actions = [];

  [1, 2].forEach(id => {
    const cards = state.players[id].table;
    cards.forEach(card => {
      actions.push({
        playerId: id,
        card,
        priority: getCardPriority(card),
      });
    });
  });

  // Приоритет: больше → раньше
  actions.sort((a, b) => b.priority - a.priority);

  let newState = { ...state };

  for (const action of actions) {
    newState = applyCardEffect(newState, action.playerId, action.card);
  }

  return {
    ...newState,
    phase: 'end',
  };
}
