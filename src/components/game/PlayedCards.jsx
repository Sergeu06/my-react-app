import React from "react";

function PlayedCards({ cards, onUndo }) {
  return (
    <div className="played-cards-section">
      {cards.map((card) => (
        <div key={card.id} className="played-card">
          <img src={card.image_url} alt={card.name} className="played-card-img" />
          <div>{card.name}</div>
          <button className="undo-card-button" onClick={() => onUndo(card)}>
            Отменить
          </button>
        </div>
      ))}
    </div>
  );
}

export default PlayedCards;
