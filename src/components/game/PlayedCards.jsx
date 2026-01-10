import React from "react";
import FramedCard from "../../utils/FramedCard";
import { renderCardStats } from "../../utils/renderCardStats";
import "./game.css";
import "./playerhand.css";

function PlayedCards({
  cards,
  onUndo,
  side = "player",
  bothTurnsEnded = false,
  roundPhase,
  turnEnded = false,
  resolving = false, // ← НОВОЕ
}) {
  const backImage = "/CARDB.jpg";

  return (
    <div className={`board-row ${side}`}>
      {cards.map((card, idx) => {
        const middleIndex = (cards.length - 1) / 2;
        const offset = idx - middleIndex;
        const tilt = offset < 0 ? "10deg" : offset > 0 ? "-10deg" : "0deg";

        const hasActiveDoT =
          Array.isArray(card.damage_over_time) &&
          (card.dotTurnsLeft ?? card.damage_over_time.length ?? 0) > 0;

        const dotClass = hasActiveDoT ? "dot-active" : "";

        // 🔒 Отмена доступна ТОЛЬКО до завершения хода
        const canUndo =
          side === "player" &&
          typeof onUndo === "function" &&
          roundPhase === "play" &&
          card.locked !== true;

        return (
          <div
            key={card.id || idx}
            className={`played-card-wrapper ${dotClass}`}
            data-id={card.id}
            title={side === "player" ? card.name : "Opponent card"}
            style={{ "--tilt": tilt }}
          >
            {side === "player" ||
            bothTurnsEnded ||
            hasActiveDoT ||
            card.revealed ? (
              <>
                <FramedCard
                  card={card}
                  showLevel
                  showName={false}
                  showPriority
                />

                {card.value !== undefined && (
                  <div className="card-corner cost">
                    {card.energyCost ?? card.value}
                  </div>
                )}

                {renderCardStats(card).map((stat, index) => (
                  <div
                    key={stat.label + index}
                    className={`card-corner ${stat.type}`}
                    style={{
                      bottom: `${-12 + index * 22}px`,
                      left: -12,
                      fontSize: "1em",
                    }}
                  >
                    {stat.value ?? "×"}
                  </div>
                ))}

                {canUndo && (
                  <button
                    className="undo-card-button"
                    onClick={() => onUndo(card)}
                  >
                    Отменить
                  </button>
                )}
              </>
            ) : (
              <img
                src={backImage}
                alt="opponent card back"
                className="opponent-card-back"
                draggable={false}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PlayedCards;
