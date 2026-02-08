// EditFloatingButton.jsx
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import "./Collection.css";

export default function EditFloatingButton({ isEditMode, onToggle }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipText = isEditMode
    ? "Режим редактирования включён. Клики по картам будут добавлять или убирать их из колоды."
    : "Выход из режима редактирования. Следующие клики по карточкам будут открывать меню взаимодействия.";

  // Скрываем подсказку при следующем прикосновении или клике
  useEffect(() => {
    if (!showTooltip) return;

    const hideTooltip = () => setShowTooltip(false);

    document.addEventListener("click", hideTooltip, { once: true });
    document.addEventListener("touchstart", hideTooltip, { once: true });

    return () => {
      document.removeEventListener("click", hideTooltip);
      document.removeEventListener("touchstart", hideTooltip);
    };
  }, [showTooltip]);

  return ReactDOM.createPortal(
    <>
      <button
        className="edit-floating-button"
        onClick={onToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        {isEditMode ? (
          <CloseIcon style={{ color: "var(--cp-accent-cyan)" }} />
        ) : (
          <EditIcon style={{ color: "var(--cp-accent-cyan)" }} />
        )}
      </button>

      {showTooltip && (
        <div
          className="edit-tooltip"
          style={{
            position: "fixed",
            bottom: 140,
            right: 20,
            backgroundColor: "var(--surface-2)",
            color: "var(--text-primary)",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(49, 247, 255, 0.4)",
            fontSize: "12px",
            zIndex: 10001,
            maxWidth: "250px",
            boxShadow: "0 10px 20px rgba(0, 0, 0, 0.35)",
          }}
        >
          {tooltipText}
        </div>
      )}
    </>,
    document.body
  );
}
