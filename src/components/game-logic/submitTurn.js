export function submitTurn(state, playerId, cardIds) {
  const newPlayers = { ...state.players };
  const player = newPlayers[playerId];

  const selected = player.hand.filter(c => cardIds.includes(c.id));
  player.hand = player.hand.filter(c => !cardIds.includes(c.id));
  player.table = selected;

  const bothSubmitted = Object.values(newPlayers).every(p => p.table.length > 0);

  return {
    ...state,
    players: newPlayers,
    phase: bothSubmitted ? 'reveal' : state.phase,
  };
}
