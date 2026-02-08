import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "./UserContext";
import "./CurrencyBalance.css";

const BALANCE_DOCK = {
  offset: "12px",
};

function CurrencyBalance({
  forceShow = false,
  balanceOverride,
  secretOverride,
}) {
  const { userData } = useUser();
  const location = useLocation();
  const hintRef = useRef(null);
  const hintRecipesRef = useRef(null);
  const balanceRef = useRef(null);

  const path = location.pathname.toLowerCase();
  const [showHint, setShowHint] = useState(false);
  const [showHintRecipes, setShowHintRecipes] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const hiddenPaths = ["/raid", "/game", "/profile", "/open-box"];
  const showMystery = path === "/upgrade" || forceShow;
  const [showHintTickets, setShowHintTickets] = useState(false);
  const hintTicketsRef = useRef(null);

  useEffect(() => {
    setIsExpanded(false);
  }, [path]);

  useEffect(() => {
    if (!showHint) return;

    const hideHint = () => setShowHint(false);

    document.addEventListener("click", hideHint, { once: true });
    document.addEventListener("touchstart", hideHint, { once: true });
    document.addEventListener("scroll", hideHint, { once: true });

    return () => {
      document.removeEventListener("click", hideHint);
      document.removeEventListener("touchstart", hideHint);
      document.removeEventListener("scroll", hideHint);
    };
  }, [showHint]);
  useEffect(() => {
    if (!showHintTickets) return;

    const hideHint = () => setShowHintTickets(false);

    document.addEventListener("click", hideHint, { once: true });
    document.addEventListener("touchstart", hideHint, { once: true });
    document.addEventListener("scroll", hideHint, { once: true });

    return () => {
      document.removeEventListener("click", hideHint);
      document.removeEventListener("touchstart", hideHint);
      document.removeEventListener("scroll", hideHint);
    };
  }, [showHintTickets]);

  useEffect(() => {
    if (!showHintRecipes) return;

    const hideHint = () => setShowHintRecipes(false);

    document.addEventListener("click", hideHint, { once: true });
    document.addEventListener("touchstart", hideHint, { once: true });
    document.addEventListener("scroll", hideHint, { once: true });

    return () => {
      document.removeEventListener("click", hideHint);
      document.removeEventListener("touchstart", hideHint);
      document.removeEventListener("scroll", hideHint);
    };
  }, [showHintRecipes]);

  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event) => {
      if (balanceRef.current?.contains(event.target)) return;
      setIsExpanded(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isExpanded]);

  if (!userData) return null;
  if (!forceShow && hiddenPaths.includes(path)) return null;
  const displayedBalance =
    typeof balanceOverride === "number" ? balanceOverride : userData.balance;
  const displayedRecipes =
    typeof secretOverride === "number"
      ? secretOverride
      : userData.SecretRecipes;

  return (
    <>
      {/* Монеты */}
      <div
        className={`currency-dock ${isExpanded ? "expanded" : "collapsed"}`}
        ref={balanceRef}
      >
        <button
          type="button"
          className="currency-dock-toggle"
          aria-expanded={isExpanded}
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded((prev) => !prev);
          }}
        >
          <img src="/moneta.png" alt="Баланс" />
          {!isExpanded && (
            <span className="currency-dock-toggle-value">
              {(displayedBalance ?? 0).toFixed(0)}
            </span>
          )}
        </button>
        <div
          className={`currency-dock-panel ${
            isExpanded ? "expanded" : "collapsed"
          }`}
        >
          <div
            className="currency-dock-item"
            onClick={(e) => {
              e.stopPropagation();
              setShowHint(true);
            }}
          >
            <img src="/moneta.png" alt="coin" />
            <span>{(displayedBalance ?? 0).toFixed(2)}</span>
          </div>
          {/* Билеты (Tickets) */}
          {path === "/fight" && (
            <div
              className="currency-dock-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowHintTickets(true);
              }}
            >
              <img src="/ticket.png" alt="Tickets" />
              <span>{userData.tickets ?? 0}</span>
            </div>
          )}

          {/* Secret Recipes */}
          {showMystery && (
            <div
              className="currency-dock-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowHintRecipes(true);
              }}
            >
              <img src="/666666.png" alt="Secret Recipes" />
              <span>{displayedRecipes ?? 0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Подсказка по монетам */}
      {showHint && (
        <div
          ref={hintRef}
          style={{
            position: "fixed",
            top: `calc(env(safe-area-inset-top, 0px) + ${BALANCE_DOCK.offset})`,
            left: `calc(env(safe-area-inset-left, 0px) + ${BALANCE_DOCK.offset})`,
            right: "auto",
            backgroundColor: "var(--surface-2)",
            color: "var(--text-primary)",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid rgba(49, 247, 255, 0.4)",
            fontSize: "12px",
            zIndex: 10002,
            width: "100%",
            maxWidth: "240px",
            boxShadow: "0 10px 20px rgba(0, 0, 0, 0.35)",
          }}
        >
          <strong>Золото:</strong> <br />
          Получение: участие в сражениях, открытие сундуков, награды за миссии.{" "}
          <br />
          Трата: покупка карт, участие в рейдах, прокачка. <br />
          Нажмите в любом месте, чтобы скрыть.
        </div>
      )}
      {/* Подсказка по Tickets */}
      {path === "/fight" && showHintTickets && (
        <div
          ref={hintTicketsRef}
          style={{
            position: "fixed",
            top: `calc(env(safe-area-inset-top, 0px) + ${BALANCE_DOCK.offset} + 56px)`,
            left: `calc(env(safe-area-inset-left, 0px) + ${BALANCE_DOCK.offset})`,
            right: "auto",
            backgroundColor: "var(--surface-2)",
            color: "var(--text-primary)",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid rgba(49, 247, 255, 0.4)",
            fontSize: "12px",
            zIndex: 10002,
            width: "100%",
            maxWidth: "240px",
            boxShadow: "0 10px 20px rgba(0, 0, 0, 0.35)",
          }}
        >
          <strong>Билеты:</strong> <br />
          Используются для участия в боях с легендарными монстрани с другими
          игроками. <br />
          Нажмите в любом месте, чтобы скрыть.
        </div>
      )}

      {/* Подсказка по Secret Recipes */}
      {showHintRecipes && (
        <div
          ref={hintRecipesRef}
          style={{
            position: "fixed",
            top: `calc(env(safe-area-inset-top, 0px) + ${BALANCE_DOCK.offset} + 56px)`,
            left: `calc(env(safe-area-inset-left, 0px) + ${BALANCE_DOCK.offset})`,
            right: "auto",
            backgroundColor: "var(--surface-2)",
            color: "var(--text-primary)",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid rgba(49, 247, 255, 0.4)",
            fontSize: "12px",
            zIndex: 10002,
            width: "100%",
            maxWidth: "240px",
            boxShadow: "0 10px 20px rgba(0, 0, 0, 0.35)",
          }}
        >
          <strong>Рецеты:</strong> <br />
          Получение: выполнение уникальных миссий, участие в ивентах, награды за
          достижения. <br />
          Трата: специальные улучшения, крафт редких карт. <br />
          Нажмите в любом месте, чтобы скрыть.
        </div>
      )}
    </>
  );
}

export default CurrencyBalance;
