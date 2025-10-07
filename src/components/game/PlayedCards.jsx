import React from "react";
import FramedCard from "../../utils/FramedCard";
import { renderCardStats } from "../../utils/renderCardStats";
import "./game.css";
import "./playerhand.css";

function PlayedCards({
  cards,
  onUndo,
  side = "player",
  turnEnded = false,
  bothTurnsEnded = false,
  currentRound = 1, // 👈 добавляем текущий раунд
}) {
  const backImage = "/CARDB.jpg";

  return (
    <div className={`board-row ${side}`}>
      {cards.map((card, idx) => {
        const middleIndex = (cards.length - 1) / 2;
        const offset = idx - middleIndex;
        const tilt = offset < 0 ? "10deg" : offset > 0 ? "-10deg" : "0deg";

        // Проверяем, активен ли DoT-эффект
        const hasActiveDoT =
          Array.isArray(card.damage_over_time_queue) &&
          card.damage_over_time_queue.some((d) => d.turnsLeft > 0);

        // Класс визуальной активности DoT
        const dotClass = hasActiveDoT ? "dot-active" : "";

        // Проверяем, можно ли отменять (только если карта выложена в текущем раунде)
        const canUndoThisRound =
          onUndo &&
          !turnEnded &&
          card.playedInRound === currentRound && // ← строго проверяем раунд
          !hasActiveDoT; // ← и запрещаем отмену для DoT-карт

        return (
          <div
            key={card.id || idx}
            className={`played-card-wrapper ${dotClass}`}
            data-id={card.id}
            title={side === "player" ? card.name : "Opponent card"}
            style={{ "--tilt": tilt }}
          >
            {side === "player" || bothTurnsEnded || hasActiveDoT ? (
              <>
                <FramedCard
                  card={card}
                  showLevel={true}
                  showName={false}
                  showPriority={true}
                />

                {card.value !== undefined && (
                  <div
                    className={`card-corner cost ${
                      card.energyCost > (card.currentEnergy ?? 0)
                        ? "not-enough"
                        : ""
                    }`}
                  >
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
                    {stat.value !== null ? stat.value : "×"}
                  </div>
                ))}

                {/* 👇 Отменить можно только в том же раунде, где выложена карта */}
                {canUndoThisRound && (
                  <button
                    className="undo-card-button"
                    onClick={() => onUndo(card)}
                  >
                    Отменить
                  </button>
                )}
              </>
            ) : bothTurnsEnded ? (
              <>
                <FramedCard
                  card={card}
                  showLevel={true}
                  showName={false}
                  showPriority={true}
                />
                {card.value !== undefined && (
                  <div className="card-corner cost">{card.value}</div>
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
                    {stat.value !== null ? stat.value : "×"}
                  </div>
                ))}
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
