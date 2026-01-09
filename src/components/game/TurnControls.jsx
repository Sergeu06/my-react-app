import React from "react";

function TurnControls({
  timer,
  turnEnded,
  opponentTurnEnded,
  onEndTurn,
  roundPhase,
}) {
  // ❌ Кнопка существует ТОЛЬКО в фазе play
  if (roundPhase !== "play") return null;

  // Если оба игрока закончили — скрываем
  if (turnEnded && opponentTurnEnded) return null;

  // Показываем кнопку только с таймера 20 и ниже
  if (timer > 20) return null;

  const displayTimer = timer === 0 ? 20 : timer;

  const buttonClass =
    displayTimer <= 9
      ? "end-turn-button pulse-strong"
      : displayTimer <= 10
      ? "end-turn-button pulse"
      : "end-turn-button";

  return (
    <div className="turn-controls">
      <button
        className={buttonClass}
        onClick={turnEnded ? undefined : onEndTurn}
        disabled={turnEnded}
      >
        {turnEnded ? (
          <span className="timer-digit">{displayTimer}</span>
        ) : (
          <>
            Завершить ход <span className="timer-digit">{displayTimer}</span>
          </>
        )}
      </button>
    </div>
  );
}

export default TurnControls;
