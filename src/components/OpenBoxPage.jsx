import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { db, database } from "./firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { set, ref as databaseRef } from "firebase/database";
import "./OpenBoxPage.css";
import FramedCard from "../utils/FramedCard";
import { preloadImageToCache } from "../utils/imageCache";

function OpenBoxPage({ uid }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { boxId } = location.state || {};

  const [clickStep, setClickStep] = useState(0);
  const [resultCard, setResultCard] = useState(null);
  const [isOpening, setIsOpening] = useState(true);
  const [dropChance, setDropChance] = useState(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [skipAnim, setSkipAnim] = useState(false); // ⬅ для мгновенного завершения

  // refs для актуального состояния в одном обработчике кликов
  const clickStepRef = useRef(clickStep);
  const isReadyRef = useRef(isReady);
  const animEndedRef = useRef(false); // закончилась ли анимация
  const animRunningRef = useRef(false); // идёт ли анимация

  useEffect(() => {
    clickStepRef.current = clickStep;
  }, [clickStep]);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  useEffect(() => {
    const addCardToInventory = async () => {
      if (!resultCard || !uid) return;
      try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) throw new Error("Пользователь не найден");

        const originalCardRef = doc(
          db,
          "cards",
          resultCard.card_id || resultCard.id
        );
        const originalCardSnap = await getDoc(originalCardRef);
        if (!originalCardSnap.exists())
          throw new Error("Оригинальная карта не найдена");

        const cardData = originalCardSnap.data();
        const newId = crypto.randomUUID();

        await set(databaseRef(database, `cards/${newId}`), {
          ...cardData,
          lvl: 1,
          owner: uid,
          fleet: parseFloat(Math.random().toFixed(10)),
          sell: false,
          original_id: resultCard.card_id || resultCard.id,
          upgradeBonus: 0,
          increase: cardData.increase ?? 1,
        });

        await updateDoc(userRef, { cards: arrayUnion(newId) });
      } catch (err) {
        console.error("[Лутбокс] Ошибка добавления карты в инвентарь:", err);
      }
    };
    addCardToInventory();
  }, [resultCard, uid]);

  const openBox = useCallback(async () => {
    try {
      const boxDoc = await getDoc(doc(db, "box", boxId));
      const boxData = boxDoc.data();
      const cardIds = boxData.cards || [];

      if (cardIds.length === 0) {
        setResultCard(null);
        setIsOpening(false);
        setClickStep(2);
        return;
      }

      const cardsData = [];
      for (const cardId of cardIds) {
        const cardSnap = await getDoc(doc(db, "cards", cardId));
        const cardData = cardSnap.data();
        if (cardData) cardsData.push({ id: cardId, ...cardData });
      }

      const rarities = ["Обычная", "Редкая", "Эпическая", "Легендарная"];
      const cardsByRarity = {};
      for (const r of rarities)
        cardsByRarity[r] = cardsData.filter((c) => c.rarity === r);

      const rarityChances = {
        Обычная: boxData.Обычная || 0,
        Редкая: boxData.Редкая || 0,
        Эпическая: boxData.Эпическая || 0,
        Легендарная: boxData.Легендарная || 0,
      };

      const totalWeight = Object.values(rarityChances).reduce(
        (a, b) => a + b,
        0
      );
      let rand = Math.random() * totalWeight;
      let selectedRarity =
        rarities.find((r) => (rand -= rarityChances[r]) <= 0) || rarities[0];

      const pool = cardsByRarity[selectedRarity] || [];
      if (pool.length === 0) {
        setResultCard(null);
        setIsOpening(false);
        setClickStep(2);
        return;
      }

      const selectedCard = pool[Math.floor(Math.random() * pool.length)];
      setResultCard(selectedCard);

      const perCardChance =
        pool.length > 0
          ? (rarityChances[selectedRarity] / pool.length).toFixed(2)
          : "0";
      setDropChance(perCardChance);

      await preloadImageToCache(selectedCard.image_url);
      setTimeout(() => {
        setIsReady(true);
        setLoading(false);
      }, 300);
    } catch (err) {
      console.error("Ошибка при открытии коробки:", err);
    }
  }, [boxId]);

  useEffect(() => {
    if (!boxId) {
      navigate(`/shop?start=${uid}`);
      return;
    }
    openBox();
  }, [boxId, navigate, uid, openBox]);

  // конец анимации (ловим transition/animation end)
  const handleAnimEnd = useCallback(() => {
    if (animEndedRef.current || clickStepRef.current !== 1) return;
    animEndedRef.current = true;
    animRunningRef.current = false;
    setClickStep(2);
  }, []);

  // глобальный клик — один обработчик, всегда с актуальным состоянием из ref
  const handleDocClick = useCallback(() => {
    if (!isReadyRef.current) return;

    const step = clickStepRef.current;

    if (step === 0) {
      // первый клик — старт анимации
      setSkipAnim(false);
      animEndedRef.current = false;
      animRunningRef.current = true;

      setClickStep(1);
      setIsOpening(false); // добавит класс .open у крышки
      setCardVisible(true); // покажет карту

      // дальше ждём handleAnimEnd
      return;
    }

    if (step === 1) {
      if (!animEndedRef.current && animRunningRef.current) {
        setSkipAnim(true); // отключаем плавность
        animEndedRef.current = true;
        animRunningRef.current = false;

        // Переводим в финальное состояние в следующем кадре
        requestAnimationFrame(() => {
          setIsOpening(false); // крышка полностью открыта (убрана)
          setCardVisible(true); // карта полностью показана
        });

        setClickStep(2);
        return;
      }
      navigate(`/shop?start=${uid}`);
      return;
    }

    // step >= 2 — переходим в магазин
    navigate(`/shop?start=${uid}`);
  }, [navigate, uid]);

  // навешиваем/снимаем обработчик один раз
  useEffect(() => {
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [handleDocClick]);

  return (
    <div className="open-box-page">
      <h2>Открытие коробки</h2>
      <div className={`box-container ${loading ? "loading" : ""}`}>
        {resultCard && (
          <div
            className={`rarity-glow ${
              resultCard.rarity === "Обычная"
                ? "rarity-common"
                : resultCard.rarity === "Редкая"
                ? "rarity-rare"
                : resultCard.rarity === "Эпическая"
                ? "rarity-epic"
                : resultCard.rarity === "Легендарная"
                ? "rarity-legendary"
                : ""
            }`}
          />
        )}

        <img src="/images/plate.png" className="plate" alt="plate" />

        <div
          className={`card-reveal ${cardVisible ? "visible" : ""} ${
            skipAnim ? "no-anim" : ""
          }`}
          onTransitionEnd={handleAnimEnd}
          onAnimationEnd={handleAnimEnd}
        >
          {resultCard && <FramedCard card={resultCard} showLevel={true} />}
        </div>

        <img
          src="/images/lid.png"
          className={`lid ${!isOpening ? "open" : ""} ${
            skipAnim ? "no-anim" : ""
          }`}
          alt="lid"
          onTransitionEnd={handleAnimEnd}
          onAnimationEnd={handleAnimEnd}
        />
      </div>

      {!isOpening && resultCard && (
        <div className="result-text">
          <h3 className="result-title">Вы получили:</h3>
          <p className="result-name">{resultCard.name}</p>
          <p className="result-chance">(шанс: {dropChance || "?"}%)</p>
        </div>
      )}
    </div>
  );
}

export default OpenBoxPage;
