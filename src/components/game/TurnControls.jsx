import React from "react";

function TurnControls({ timer, turnEnded, opponentTurnEnded, onEndTurn }) {
  // Оба игрока закончили — таймер полностью исчезает
  if (turnEnded && opponentTurnEnded) return null;

  // 👉 если на экране 0, показываем 30 (визуальный фикс)
  const displayTimer = timer === 0 ? 30 : timer;

  return (
    <div className="turn-controls">
      <button
        className="end-turn-button"
        onClick={turnEnded ? undefined : onEndTurn}
        disabled={turnEnded} // после завершения кнопка не кликабельна
      >
        {turnEnded ? `(${displayTimer})` : `Завершить ход (${displayTimer})`}
      </button>
    </div>
  );
}

export default TurnControls;
