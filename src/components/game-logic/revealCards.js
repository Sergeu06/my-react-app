export function revealCards(state) {
  return {
    ...state,
    phase: 'resolve',
  };
}
