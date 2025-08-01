import React, { useEffect, useState, useRef } from "react";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import {
  get as dbGet,
  databaseRef,
  retryRequest,
  db,
  database,
} from "./firebase";
import "./Collection.css";
import FramedCard from "../utils/FramedCard";
import CardModal from "./CardModal";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";

function Collection({ uid }) {
  const [playerCards, setPlayerCards] = useState([]);
  const [deck1, setDeck1] = useState([]);
  const [deck2, setDeck2] = useState([]);
  const [activeDeck, setActiveDeck] = useState(1);
  const [selectedCard, setSelectedCard] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const isAddingToDeck = useRef(false);
  const isRemovingFromDeck = useRef(false);
  const MAX_DECK_SIZE = 20;

  useEffect(() => {
    const savedDeck = localStorage.getItem("collection_activeDeck");
    if (savedDeck === "1" || savedDeck === "2") {
      setActiveDeck(Number(savedDeck));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("collection_activeDeck", activeDeck.toString());
  }, [activeDeck]);

  const addNotification = (message, type) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      4000
    );
  };

  useEffect(() => {
    const fetchPlayerData = async () => {
      try {
        setIsLoading(true);

        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        if (Array.isArray(userData.deck)) {
          await updateDoc(userRef, {
            deck: deleteField(),
            deck_pvp: [],
            deck_raid: [],
          });
        }

        const updatedSnap = await getDoc(userRef);
        const updatedData = updatedSnap.exists() ? updatedSnap.data() : {};

        const deckPvpIds = Array.isArray(updatedData.deck_pvp)
          ? updatedData.deck_pvp
          : [];
        const deckRaidIds = Array.isArray(updatedData.deck_raid)
          ? updatedData.deck_raid
          : [];
        const inventoryIds = Array.isArray(updatedData.cards)
          ? updatedData.cards
          : [];

        const loadCardsByIds = async (ids) => {
          const promises = ids.map(async (cardId) => {
            try {
              const snap = await retryRequest(() =>
                dbGet(databaseRef(database, `cards/${cardId}`))
              );
              return snap.exists ? { id: cardId, ...snap.val() } : null;
            } catch (error) {
              console.warn(`Не удалось загрузить карту ${cardId}:`, error);
              return null;
            }
          });
          return (await Promise.all(promises)).filter(Boolean);
        };

        const [deckPvpCards, deckRaidCards, inventoryCards] = await Promise.all(
          [
            loadCardsByIds(deckPvpIds),
            loadCardsByIds(deckRaidIds),
            loadCardsByIds(inventoryIds),
          ]
        );

        setDeck1(deckPvpCards);
        setDeck2(deckRaidCards);
        setPlayerCards(inventoryCards);
      } catch (error) {
        console.error("Ошибка при загрузке данных игрока:", error);
        addNotification("Не удалось загрузить данные игрока", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerData();
  }, [uid]);

  const getCurrentDeck = () => (activeDeck === 1 ? deck1 : deck2);

  const saveDeckAndInventory = async (updatedDeck, updatedInventory) => {
    try {
      const deckPvpIds = (activeDeck === 1 ? updatedDeck : deck1).map(
        (c) => c.id
      );
      const deckRaidIds = (activeDeck === 2 ? updatedDeck : deck2).map(
        (c) => c.id
      );
      const inventoryIds = updatedInventory.map((c) => c.id);

      await updateDoc(doc(db, "users", uid), {
        deck_pvp: deckPvpIds,
        deck_raid: deckRaidIds,
        cards: inventoryIds,
      });

      setDeck1(activeDeck === 1 ? updatedDeck : deck1);
      setDeck2(activeDeck === 2 ? updatedDeck : deck2);
      setPlayerCards(updatedInventory);
      addNotification("Данные обновлены", "success");
    } catch (error) {
      console.error("Ошибка при сохранении данных:", error);
      addNotification("Не удалось обновить данные.", "error");
    }
  };

  const handleAddToDeck = async (event, card) => {
    event.stopPropagation();
    if (isAddingToDeck.current) return;
    isAddingToDeck.current = true;

    try {
      const currentDeck = getCurrentDeck();

      if (
        activeDeck === 2 &&
        card.damage === undefined &&
        card.damage_multiplier === undefined &&
        card.damage_over_time === undefined
      ) {
        addNotification(
          "В рейдовую колоду можно добавлять только боевые карты.",
          "error"
        );
        return;
      }

      if (currentDeck.length >= MAX_DECK_SIZE) {
        addNotification("Лимит колоды достигнут.", "error");
        return;
      }

      const sameCardCount = currentDeck.filter(
        (c) => c.original_id === card.original_id
      ).length;
      if (sameCardCount >= 3) {
        addNotification(
          "В колоду можно добавить не более 3 копий одной карты.",
          "error"
        );
        return;
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};

      const deckPvp = userData.deck_pvp || [];
      const deckRaid = userData.deck_raid || [];
      const cards = userData.cards || [];

      const allIds = new Set([...deckPvp, ...deckRaid, ...cards]);
      if (!allIds.has(card.id)) {
        addNotification("Карта уже была добавлена.", "error");
        return;
      }

      const updatedDeck = [...currentDeck, card];
      const updatedInventory = playerCards.filter((c) => c.id !== card.id);

      await saveDeckAndInventory(updatedDeck, updatedInventory);
    } catch (error) {
      console.error("Ошибка при добавлении карты в колоду:", error);
      addNotification("Не удалось добавить карту в колоду.", "error");
    } finally {
      isAddingToDeck.current = false;
    }
  };

  const handleRemoveFromDeck = async (card) => {
    if (isRemovingFromDeck.current) return;
    isRemovingFromDeck.current = true;

    try {
      const currentDeck = getCurrentDeck();
      const updatedDeck = currentDeck.filter((c) => c.id !== card.id);
      const updatedInventory = [...playerCards, card];
      await saveDeckAndInventory(updatedDeck, updatedInventory);
    } finally {
      isRemovingFromDeck.current = false;
    }
  };

  const handleCloseModal = () => setSelectedCard(null);

  return (
    <div className="collection-container">
      <div className="notification-container">
        {notifications.map((note) => (
          <div key={note.id} className={`notification ${note.type}`}>
            {note.message}
          </div>
        ))}
      </div>

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeDeck === 1 ? "active" : ""}`}
            onClick={() => setActiveDeck(1)}
          >
            Колода ПвП
          </button>
          <button
            className={`tab ${activeDeck === 2 ? "active" : ""}`}
            onClick={() => setActiveDeck(2)}
          >
            Колода Рейда
          </button>
        </div>
      </div>

      <button
        className="edit-floating-button"
        onClick={() => setIsEditMode((prev) => !prev)}
      >
        {isEditMode ? (
          <CloseIcon style={{ color: "#ffa500" }} />
        ) : (
          <EditIcon style={{ color: "#ffa500" }} />
        )}
      </button>

      <div className="deck-info highlight-text">
        {getCurrentDeck().length} / {MAX_DECK_SIZE}
      </div>

      <div className="grid">
        {getCurrentDeck().map((card, index) => (
          <div
            key={`deck-${card.id}-${index}`}
            onClick={() => {
              if (isEditMode) handleRemoveFromDeck(card);
              else setSelectedCard(card);
            }}
            style={{ cursor: "pointer" }}
          >
            <FramedCard card={card} showLevel={true} />
          </div>
        ))}
      </div>

      <h1>Хранилище</h1>
      {isLoading ? (
        <div className="grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="skeleton-card">
              <div className="skeleton skeleton-image" />
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-price" />
            </div>
          ))}
        </div>
      ) : playerCards.length === 0 ? (
        <div className="empty-inventory">Инвентарь пуст.</div>
      ) : (
        <div className="grid">
          {playerCards.map((card, index) => (
            <div
              key={`inventory-${card.id}-${index}`}
              onClick={() => {
                if (isEditMode)
                  handleAddToDeck({ stopPropagation: () => {} }, card);
                else setSelectedCard(card);
              }}
              style={{ cursor: "pointer" }}
            >
              <FramedCard card={card} showLevel={true} />
            </div>
          ))}
        </div>
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={handleCloseModal}
          onAddToDeck={handleAddToDeck}
          addNotification={addNotification}
          playerCards={playerCards}
          setPlayerCards={setPlayerCards}
          deck1={deck1}
          setDeck1={setDeck1}
          deck2={deck2}
          setDeck2={setDeck2}
          activeDeck={activeDeck}
          uid={uid}
          db={db}
          database={database}
        />
      )}
    </div>
  );
}

export default Collection;
