import ReactDOM from "react-dom";
import "./CardTooltip.css";

const CardTooltip = ({ card, position }) => {
  if (!card || !position) return null;

  const tooltipStyle = {
    position: "absolute",
    top: position.y + window.scrollY - 30,
    left: position.x + window.scrollX,
    zIndex: 9999,
    transform: "translate(-50%, -100%)",
    pointerEvents: "none",
  };

  return ReactDOM.createPortal(
    <div className="tooltip-popup" style={tooltipStyle}>
      <h4>{card.name}</h4>
      <p>{card.description}</p>
      <div>Приоритет: {card.priority ?? "—"}</div>
      {card.damage && <div>Урон: {card.damage}</div>}
      {card.damage_multiplier && (
        <div>Множитель урона: {card.damage_multiplier}</div>
      )}
      {card.remove_multiplier && (
        <div>Удаление множителя: {card.remove_multiplier}</div>
      )}
      {card.heal && <div>Лечение: {card.heal}</div>}
    </div>,
    document.getElementById("card-tooltip-root")
  );
};

export default CardTooltip;
