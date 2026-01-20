import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  db,
  database,
  retryRequest,
  update,
  databaseRef,
  get,
  remove,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  runTransaction,
} from "./firebase";

import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import TuneIcon from "@mui/icons-material/Tune";
import IconButton from "@mui/material/IconButton";

import FramedCard from "../utils/FramedCard";
import MarketModal from "./MarketModal";
import "./Market.css";

function useQuery() {
  return new URLSearchParams(window.location.search);
}

function SkeletonCard() {
  return (
    <div className="card skeleton-card">
      <div className="skeleton skeleton-title"></div>
      <div className="skeleton skeleton-image"></div>
      <div className="skeleton skeleton-price"></div>
      <div className="skeleton skeleton-seller"></div>
    </div>
  );
}

const normalizeRarity = (rarity) =>
  (rarity || "обычная").toString().trim().toLowerCase();
const rarityOrder = { обычная: 1, редкая: 2, эпическая: 3, легендарная: 4 };
const getCardType = (card) =>
  (card.cardDetails?.type ||
    card.cardDetails?.card_type ||
    card.cardDetails?.category ||
    "")
    .toString()
    .trim()
    .toLowerCase();

function Market({ setError }) {
  const [allCards, setAllCards] = useState([]);
  const [allCardsFull, setAllCardsFull] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [removingCardKey, setRemovingCardKey] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortMode, setSortMode] = useState("relevance");
  const [rarityFilters, setRarityFilters] = useState({
    обычная: true,
    редкая: true,
    эпическая: true,
    легендарная: true,
  });
  const [typeFilters, setTypeFilters] = useState({});

  const query = useQuery();
  const currentUid = query.get("start");
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 12;
  const [totalPages, setTotalPages] = useState(1);

  const typeOptions = useMemo(() => {
    const types = new Set();
    allCardsFull.forEach((card) => {
      const type = getCardType(card) || "прочее";
      types.add(type);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b, "ru"));
  }, [allCardsFull]);

  useEffect(() => {
    setTypeFilters((prev) => {
      const next = { ...prev };
      typeOptions.forEach((type) => {
        if (next[type] === undefined) next[type] = true;
      });
      return next;
    });
  }, [typeOptions]);

  const sortMarketCards = useCallback(
    (cards) => {
      if (sortMode === "relevance" && searchTerm.trim()) {
        return [...cards].sort((a, b) => b.relevance - a.relevance);
      }

      if (sortMode === "rarity") {
        return [...cards].sort((a, b) => {
          const rarityA = normalizeRarity(a.cardDetails?.rarity);
          const rarityB = normalizeRarity(b.cardDetails?.rarity);
          return (rarityOrder[rarityB] || 0) - (rarityOrder[rarityA] || 0);
        });
      }

      if (sortMode === "alphabet") {
        return [...cards].sort((a, b) =>
          (a.cardDetails?.name || "").localeCompare(
            b.cardDetails?.name || "",
            "ru"
          )
        );
      }

      if (sortMode === "type") {
        return [...cards].sort((a, b) =>
          getCardType(a).localeCompare(getCardType(b), "ru")
        );
      }

      return cards;
    },
    [sortMode, searchTerm]
  );

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim();
    const minValue = Number.parseFloat(minPrice);
    const maxValue = Number.parseFloat(maxPrice);
    const hasMin = !Number.isNaN(minValue);
    const hasMax = !Number.isNaN(maxValue);

    const applyPriceFilter = (cards) =>
      cards.filter((card) => {
        if (hasMin && card.price < minValue) return false;
        if (hasMax && card.price > maxValue) return false;
        return true;
      });

    const applyRarityFilter = (cards) =>
      cards.filter((card) => {
        const rarity = normalizeRarity(card.cardDetails?.rarity);
        return rarityFilters[rarity] !== false;
      });

    const applyTypeFilter = (cards) =>
      cards.filter((card) => {
        const type = getCardType(card) || "прочее";
        return typeFilters[type] !== false;
      });

    if (!term) {
      const filteredCards = applyTypeFilter(
        applyRarityFilter(applyPriceFilter(allCardsFull))
      );
      const sortedCards = sortMarketCards(filteredCards);
      const total = Math.max(
        1,
        Math.ceil(sortedCards.length / cardsPerPage)
      );
      if (currentPage > total) setCurrentPage(total);
      setTotalPages(total);
      const startIndex = (currentPage - 1) * cardsPerPage;
      const endIndex = startIndex + cardsPerPage;
      setAllCards(sortedCards.slice(startIndex, endIndex));
      return;
    }

    const computeRelevance = (card) => {
      let score = 0;

      const { cardDetails, price } = card;

      if (cardDetails?.name?.toLowerCase() === term) score += 100;
      else if (cardDetails?.name?.toLowerCase().includes(term)) score += 50;

      if (String(price) === term) score += 80;
      else if (String(price).includes(term)) score += 40;

      const stats = renderCardStats(card.cardDetails || {});
      for (const line of stats) {
        if (line.toLowerCase().includes(term)) score += 20;
      }

      return score;
    };

    const filteredBySearch = [...allCardsFull]
      .map((card) => ({ ...card, relevance: computeRelevance(card) }))
      .filter((card) => card.relevance > 0);

    const filteredByPrice = applyPriceFilter(filteredBySearch);
    const filteredByRarity = applyRarityFilter(filteredByPrice);
    const filteredByType = applyTypeFilter(filteredByRarity);
    const sorted = sortMarketCards(filteredByType);

    setAllCards(sorted.slice(0, cardsPerPage));
    setTotalPages(Math.ceil(sorted.length / cardsPerPage) || 1);
    setCurrentPage(1);
  }, [
    searchTerm,
    allCardsFull,
    currentPage,
    minPrice,
    maxPrice,
    sortMarketCards,
    rarityFilters,
    typeFilters,
  ]);

  const renderCardStats = (card) => {
    if (!card) return [];

    const bonus = card.bonus || {};
    const stats = [];

    if (card.damage !== undefined) {
      stats.push(`Урон: ${card.damage + (bonus.damage || 0)}`);
    }

    if (card.heal !== undefined) {
      stats.push(`Лечение: ${card.heal + (bonus.heal || 0)}`);
    }

    if (card.damage_multiplier !== undefined) {
      const total = (
        card.damage_multiplier + (bonus.damage_multiplier || 0)
      ).toFixed(2);
      stats.push(`Множитель урона: x${total}`);
    }

    if (card.remove_multiplier) {
      stats.push(`Удаляет множитель`);
    }

    return stats;
  };

  const fetchMarketCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const marketRef = databaseRef(database, "market");
      const marketSnapshot = await retryRequest(() => get(marketRef));

      if (marketSnapshot.exists()) {
        const marketData = marketSnapshot.val();

        const cardsData = await Promise.all(
          Object.entries(marketData).map(async ([key, marketCard]) => {
            const price = marketCard.price;
            const sellerName = marketCard.sellerName;
            const sellerUid = marketCard.sellerUid || null;

            const cardRef = databaseRef(database, `cards/${key}`);
            const cardSnapshot = await retryRequest(() => get(cardRef));
            const cardDetails = cardSnapshot.exists()
              ? cardSnapshot.val()
              : null;

            if (!cardDetails) return null;

            return {
              key,
              card_id: key,
              price,
              sellerName,
              sellerUid,
              cardDetails,
            };
          })
        );

        const filteredCards = cardsData.filter(Boolean);
        setAllCardsFull(filteredCards);
      } else {
        setAllCards([]);
        setAllCardsFull([]);
        setError("На рынке нет карт.");
      }
    } catch (error) {
      setError("Не удалось загрузить карты с рынка.");
    } finally {
      setIsLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    fetchMarketCards();
  }, [fetchMarketCards]);

  const nextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const prevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const openPurchaseModal = (card) => setSelectedCard(card);
  const closePurchaseModal = () => {
    setSelectedCard(null);
    setActionInProgress(false);
  };

  const handleRemoveFromMarket = async () => {
    if (!selectedCard) return;
    const marketKey = selectedCard.key;
    setActionInProgress(true);
    setRemovingCardKey(marketKey);

    try {
      const userRef = doc(db, "users", currentUid);
      await updateDoc(userRef, {
        cards: arrayUnion(selectedCard.key),
      });

      await update(databaseRef(database, `cards/${marketKey}`), {
        sell: false,
      });

      await remove(databaseRef(database, `market/${marketKey}`));

      const updatedFullList = allCardsFull.filter(
        (card) => card.key !== marketKey
      );
      setAllCardsFull(updatedFullList);
      setRemovingCardKey(null);
      closePurchaseModal();
    } catch (error) {
      setError("Ошибка при снятии карты с рынка.");
      setActionInProgress(false);
      setRemovingCardKey(null);
    }
  };

  const handlePurchase = async () => {
    if (!selectedCard) return;
    setActionInProgress(true);

    try {
      const cardRef = databaseRef(database, `cards/${selectedCard.key}`);
      const cardSnapshot = await retryRequest(() => get(cardRef));
      const cardData = cardSnapshot.exists() ? cardSnapshot.val() : null;

      if (!cardData) {
        setError("Карта больше не существует.");
        return;
      }

      if (cardData.sell === false) {
        setError("Карта больше недоступна.");
        return;
      }

      const sellerUid = cardData.owner;

      if (sellerUid === currentUid) {
        await handleRemoveFromMarket();
        return;
      }

      const buyerRef = doc(db, "users", currentUid);
      const buyerDoc = await getDoc(buyerRef);
      const buyerData = buyerDoc.exists() ? buyerDoc.data() : {};

      if (buyerData.balance >= selectedCard.price) {
        // 1. Списываем у покупателя
        await updateDoc(buyerRef, {
          balance: buyerData.balance - selectedCard.price,
          cards: arrayUnion(selectedCard.key),
          "stats.coins_spent":
            (buyerData.stats?.coins_spent ?? 0) + selectedCard.price,
        });

        // 2. Выплата продавцу
        const payout = Math.floor(selectedCard.price * 0.92);
        if (sellerUid && sellerUid !== currentUid) {
          const sellerRef = doc(db, "users", sellerUid);

          await runTransaction(db, async (transaction) => {
            const sellerSnap = await transaction.get(sellerRef);
            if (!sellerSnap.exists()) return;

            const currentBalance = sellerSnap.data().balance || 0;
            transaction.update(sellerRef, {
              balance: currentBalance + payout,
            });
          });
        }

        // 3. Обновляем карточку и убираем с рынка
        await retryRequest(() =>
          update(databaseRef(database, `cards/${selectedCard.key}`), {
            owner: currentUid,
            sell: false,
          })
        );

        await remove(databaseRef(database, `market/${selectedCard.key}`));

        // 4. Обновляем UI
        const updatedFullList = allCardsFull.filter(
          (card) => card.key !== selectedCard.key
        );
        setAllCardsFull(updatedFullList);
        closePurchaseModal();
      } else {
        setError("Недостаточно средств.");
      }
    } catch (error) {
      setError("Ошибка при покупке карты.");
    } finally {
      setActionInProgress(false);
    }
  };

  const renderCardSpecialEffect = (details) => {
    return renderCardStats(details).map((line, idx) => (
      <div key={idx}>{line}</div>
    ));
  };

  const formatTypeLabel = (type) =>
    type === "прочее" || !type
      ? "Прочее"
      : `${type.charAt(0).toUpperCase()}${type.slice(1)}`;

  return (
    <div className="market-container">
      <div className="search-refresh-container">
        <div className="search-bar">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder=""
          />
          {!searchTerm && (
            <div className="placeholder-mask">
              <div className="scrolling-text">
                Название, Цена, Характеристика, Уровень...
              </div>
            </div>
          )}
        </div>
        <div className="market-filter-wrapper">
          <button
            type="button"
            className={`market-filter-toggle ${filtersOpen ? "open" : ""}`}
            onClick={() => setFiltersOpen((prev) => !prev)}
            aria-expanded={filtersOpen}
            aria-controls="market-filter-panel"
          >
            <TuneIcon fontSize="small" />
            Фильтры
          </button>
          {filtersOpen && (
            <div className="market-filter-panel" id="market-filter-panel">
              <div className="market-filter-section">
                <div className="market-filter-label">Стоимость</div>
                <div className="market-filter-row">
                  <input
                    type="number"
                    min="0"
                    placeholder="От"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="market-filter-input"
                  />
                  <span className="market-filter-separator">—</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="До"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="market-filter-input"
                  />
                </div>
              </div>
              <div className="market-filter-section">
                <label className="market-filter-label" htmlFor="market-sort">
                  Сортировка
                </label>
                <select
                  id="market-sort"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="market-filter-select"
                >
                  <option value="relevance">По релевантности</option>
                  <option value="rarity">По редкости</option>
                  <option value="alphabet">По алфавиту</option>
                  <option value="type">По типу карты</option>
                </select>
              </div>
              <div className="market-filter-section">
                <div className="market-filter-label">Редкость</div>
                <div className="market-filter-options">
                  {Object.keys(rarityOrder).map((rarity) => (
                    <label className="market-filter-checkbox" key={rarity}>
                      <input
                        type="checkbox"
                        checked={rarityFilters[rarity] !== false}
                        onChange={() =>
                          setRarityFilters((prev) => ({
                            ...prev,
                            [rarity]: !(prev[rarity] !== false),
                          }))
                        }
                      />
                      <span>
                        {rarity.charAt(0).toUpperCase()}
                        {rarity.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="market-filter-section">
                <div className="market-filter-label">Тип карты</div>
                <div className="market-filter-options">
                  {typeOptions.map((type) => (
                    <label className="market-filter-checkbox" key={type}>
                      <input
                        type="checkbox"
                        checked={typeFilters[type] !== false}
                        onChange={() =>
                          setTypeFilters((prev) => ({
                            ...prev,
                            [type]: !(prev[type] !== false),
                          }))
                        }
                      />
                      <span>{formatTypeLabel(type)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <IconButton
          onClick={fetchMarketCards}
          title="Обновить список"
          sx={{
            backgroundColor: "#2e2e2e",
            "&:hover": { backgroundColor: "#2e2e2e" },
          }}
        >
          <RefreshIcon style={{ color: "#ffa500" }} />
        </IconButton>
      </div>

      <div className="card-grid-panel market-grid-panel">
        <div className="grid">
          {isLoading
            ? Array.from({ length: cardsPerPage }).map((_, index) => (
                <SkeletonCard key={index} />
              ))
            : allCards.map((card) => (
                <div key={card.key} onClick={() => openPurchaseModal(card)}>
                  <FramedCard card={card.cardDetails} showLevel={true} />
                  <div className="price-row" style={{ marginTop: "8px" }}>
                    <span>Цена: {card.price}</span>
                    <img src="/moneta.png" alt="coin" />
                  </div>
                  <div>Продавец: {card.sellerName || "Неизвестный"}</div>
                </div>
              ))}
        </div>
      </div>

      <div className="pagination">
        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="page-btn"
        >
          ←
        </button>
        <span>
          Страница {currentPage} из {totalPages}
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= totalPages}
          className="page-btn"
        >
          →
        </button>
      </div>

      <MarketModal
        card={selectedCard}
        onClose={closePurchaseModal}
        onPurchase={handlePurchase}
        onRemove={handleRemoveFromMarket}
        actionInProgress={actionInProgress}
        currentUid={currentUid}
        renderCardSpecialEffect={renderCardSpecialEffect}
      />
    </div>
  );
}

export default Market;
