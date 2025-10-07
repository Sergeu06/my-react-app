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
          <CloseIcon style={{ color: "#ffa500" }} />
        ) : (
          <EditIcon style={{ color: "#ffa500" }} />
        )}
      </button>

      {showTooltip && (
        <div
          className="edit-tooltip"
          style={{
            position: "fixed",
            bottom: 140,
            right: 20,
            backgroundColor: "#1e1e1e",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #ffa500",
            fontSize: "12px",
            zIndex: 10001,
            maxWidth: "250px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          }}
        >
          {tooltipText}
        </div>
      )}
    </>,
    document.body
  );
}
