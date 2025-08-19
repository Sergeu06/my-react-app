import React from "react";

function TurnControls({ timer, turnEnded, onEndTurn }) {
  if (turnEnded) return null;

  return (
    <div className="turn-controls">
      <button className="end-turn-button" onClick={onEndTurn}>
        Завершить ход ({timer})
      </button>
    </div>
  );
}

export default TurnControls;
