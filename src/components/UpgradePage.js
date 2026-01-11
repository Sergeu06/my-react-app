import React, { useEffect, useState } from "react";
import CachedImage from "../utils/CachedImage";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import {
  get as rtdbGet,
  ref,
  remove as rtdbRemove,
  set as rtdbSet,
  update as rtdbUpdate,
} from "firebase/database";
import { db, database } from "./firebase";
import { useUser } from "./UserContext";
import "./UpgradePage.css";
import { toRoman } from "../utils/toRoman";

function UpgradePage() {
  const { userData } = useUser();
  const uid = userData?.uid;

  const [upgradeResult, setUpgradeResult] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [animationSuccess, setAnimationSuccess] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  const [playerCards, setPlayerCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] = useState(false);
  const [activeTab, setActiveTab] = useState("upgrade");

  const [fusionSlots, setFusionSlots] = useState(Array(5).fill(null));
  const [fusionSlotIndex, setFusionSlotIndex] = useState(null);
  const [showFusionModal, setShowFusionModal] = useState(false);
  const [fusionBonus, setFusionBonus] = useState(0);
  const [fusionResult, setFusionResult] = useState(null);
  const [fusionError, setFusionError] = useState("");
  const [fusionInProgress, setFusionInProgress] = useState(false);
  const [secretBalance, setSecretBalance] = useState(
    userData?.SecretRecipes ?? 0
  );

  useEffect(() => {
    setSecretBalance(userData?.SecretRecipes ?? 0);
  }, [userData]);

  useEffect(() => {
    if (!uid) return;
    const fetchCards = async () => {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const allIds = new Set([
        ...(userData.cards || []),
        ...(userData.deck_raid || []),
        ...(userData.deck_pvp || []),
      ]);
      const cardIds = Array.from(allIds);

      const deckRaid = new Set(userData.deck_raid || []);
      const deckPvp = new Set(userData.deck_pvp || []);

      const cardPromises = cardIds.map(async (cardId) => {
        const cardSnap = await rtdbGet(ref(database, `cards/${cardId}`));
        if (!cardSnap.exists()) return null;
        const cardData = cardSnap.val();
        const inRaid = deckRaid.has(cardId);
        const inPvp = deckPvp.has(cardId);
        return {
          ...cardData,
          card_id: cardId,
          inRaid,
          inPvp,
        };
      });

      const allCards = await Promise.all(cardPromises);
      const validCards = allCards.filter(Boolean);
      setPlayerCards(validCards);
    };

    fetchCards();
  }, [uid]);

  const normalizeRarity = (rarity) => {
    if (!rarity) return "обычная";
    const lower = rarity.toLowerCase();
    if (lower.includes("легенд")) return "легендарная";
    if (lower.includes("эпич")) return "эпическая";
    if (lower.includes("редк")) return "редкая";
    if (lower.includes("comm") || lower.includes("обыч")) return "обычная";
    return lower;
  };

  const getCardCharacteristicType = (card) => {
    if (
      Array.isArray(card.damage_over_time) &&
      card.damage_over_time.length > 0
    ) {
      return "damage_over_time";
    }
    if (card.remove_multiplier) return "remove_multiplier";
    if (card.damage) return "damage";
    if (card.heal) return "heal";
    if (card.damage_multiplier) return "damage_multiplier";
    return "other";
  };

  const characteristicLabels = {
    damage: "Урон",
    heal: "Лечение",
    damage_multiplier: "Множитель урона",
    damage_over_time: "Поэтапный урон",
    remove_multiplier: "Снятие эффекта",
    other: "Прочее",
  };

  const handleCardSelect = async (card) => {
    if (!card.original_id) {
      setSelectedCard(card);
      setShowCardModal(false);
      return;
    }

    try {
      const templateRef = doc(db, "cards", card.original_id);
      const templateSnap = await getDoc(templateRef);
      const templateData = templateSnap.exists() ? templateSnap.data() : {};

      setSelectedCard({
        ...card,
        templateDot: Array.isArray(templateData.damage_over_time)
          ? templateData.damage_over_time
          : [],
      });
    } catch (error) {
      console.error("Ошибка загрузки шаблона карты:", error);
      setSelectedCard(card); // fallback
    }

    setShowCardModal(false);
  };

  const infoContent = (
    <div style={{ lineHeight: "1.5", fontSize: "15px" }}>
      <h3 style={{ marginBottom: "8px", color: "#ffa500" }}>
        Повышение ранга карты
      </h3>
      <p style={{ marginBottom: "16px" }}>
        <span style={{ color: "#ffa500", fontWeight: "bold" }}>
          Повышение ранга
        </span>{" "}
        — ключ к раскрытию полного потенциала карты.
      </p>

      <h4 style={{ marginBottom: "8px", color: "#ffa500" }}>
        Что нужно для улучшения
      </h4>
      <ul style={{ marginBottom: "16px", paddingLeft: "20px" }}>
        <li>
          <span style={{ color: "#ffa500", fontWeight: "bold" }}>Монеты:</span>{" "}
          стоимость = уровень × 100
        </li>
        <li>
          <span style={{ color: "#ffa500", fontWeight: "bold" }}>
            Secret Recipes:
          </span>{" "}
          требуются с 2 уровня (уровень - 1)
        </li>
      </ul>

      <h4 style={{ marginBottom: "8px", color: "#ffa500" }}>Шанс успеха</h4>
      <ul style={{ marginBottom: "16px", paddingLeft: "20px" }}>
        <li>Начинается с высоких значений, но падает с каждым уровнем.</li>
        <li>Чем выше уровень — тем больше решает удача или стратегия.</li>
      </ul>

      <h4 style={{ marginBottom: "8px", color: "#ffa500" }}>
        Неудача — не всегда плохо
      </h4>
      <ul style={{ marginBottom: "16px", paddingLeft: "20px" }}>
        <li>
          При провале шанс на успех в следующий раз{" "}
          <span style={{ color: "#ffa500" }}>увеличивается</span>.
        </li>
        <li>Терпение и подготовка иногда важнее спешки.</li>
      </ul>

      <h4 style={{ marginBottom: "8px", color: "#ffa500" }}>Предпросмотр</h4>
      <ul style={{ marginBottom: "16px", paddingLeft: "20px" }}>
        <li>
          Показывает, как изменятся характеристики карты на следующем уровне.
        </li>
        <li>
          Некоторые эффекты растут{" "}
          <span style={{ color: "#ffa500" }}>неравномерно</span>.
        </li>
        <li>
          Есть характеристики, которые можно усиливать бесконечно, если знать, в
          какую карту вкладываться.
        </li>
      </ul>

      <h4 style={{ marginBottom: "8px", color: "#ffa500" }}>Подсказка</h4>
      <ul style={{ marginBottom: "16px", paddingLeft: "20px" }}>
        <li>
          Не все бонусы заметны сразу. Некоторые начинают работать только при
          определённом уровне или в связке с другими картами.
        </li>
        <li>
          Иногда стоит оставить карту на текущем уровне, чтобы использовать
          ресурсы более эффективно.
        </li>
      </ul>

      <h4 style={{ marginBottom: "8px", color: "#ffa500" }}>Совет</h4>
      <p>
        Если вероятность успеха слишком мала, подумайте, готовы ли вы рискнуть.
        Иногда{" "}
        <span style={{ color: "#ffa500", fontWeight: "bold" }}>провал</span> —
        это шаг к большой победе.
      </p>
    </div>
  );

  const getBaseSuccessRate = (level) => {
    const lvl = Math.max(1, Number(level));
    if (lvl === 1) return 1;
    if (lvl === 2) return 0.75;
    if (lvl === 3) return 0.6;
    if (lvl === 4) return 0.5;
    if (lvl === 5) return 0.4;
    if (lvl === 6) return 0.3;
    if (lvl === 7) return 0.25;
    if (lvl === 8) return 0.2;
    if (lvl === 9) return 0.15;
    if (lvl === 10) return 0.1;
    if (lvl === 11) return 0.05;
    const rate = 0.05 - 0.01 * (lvl - 11);
    return rate > 0.01 ? rate : 0.01;
  };

  const getSuccessRate = (level, bonus) => {
    const baseRate = getBaseSuccessRate(level);
    const total = baseRate + (bonus || 0);
    return total > 1 ? 1 : total;
  };

  const upgradeSelectedCard = async () => {
    if (!selectedCard || !uid || !userData) return;

    setLoadingUpgrade(true);
    setUpgradeResult(null);
    setAnimationSuccess(null);
    setAnimating(true);

    const currentLevel = selectedCard.lvl || 1;
    const upgradeCost = currentLevel * 100;
    const secretCost = Math.max(0, currentLevel - 1);

    if ((userData.balance ?? 0) < upgradeCost) {
      alert(`Недостаточно монет: требуется ${upgradeCost}`);
      setLoadingUpgrade(false);
      setAnimating(false);
      return;
    }

    if ((userData.SecretRecipes ?? 0) < secretCost) {
      alert(`Недостаточно SecretRecipes: требуется ${secretCost}`);
      setLoadingUpgrade(false);
      setAnimating(false);
      return;
    }

    const currentBonus = selectedCard.upgradeBonus || 0;
    const successRate = getSuccessRate(currentLevel, currentBonus);
    const success = Math.random() < successRate;

    try {
      // 1. Получаем пользователя
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("Пользователь не найден");
      const userDoc = userSnap.data();

      // 2. Получаем данные карты из RTDB
      const cardRef = ref(database, `cards/${selectedCard.card_id}`);
      const cardSnap = await rtdbGet(cardRef);
      if (!cardSnap.exists()) throw new Error("Карта не найдена");
      const cardData = cardSnap.val();

      const updatedCard = { ...cardData };

      // 3. Загружаем шаблон карты из Firestore по original_id
      if (!updatedCard.original_id)
        throw new Error("original_id карты отсутствует");
      const templateRef = doc(db, "cards", updatedCard.original_id);
      const templateSnap = await getDoc(templateRef);
      if (!templateSnap.exists()) throw new Error("Шаблон карты не найден");
      const templateData = templateSnap.data();

      // Определяем изначальную длину damage_over_time из шаблона
      const originalDot = Array.isArray(templateData.damage_over_time)
        ? templateData.damage_over_time
        : null;
      const originalDotLength = originalDot ? originalDot.length : 0;

      if (success) {
        updatedCard.lvl = (updatedCard.lvl || 1) + 1;
        updatedCard.bonus = updatedCard.bonus || {};

        const inc = Number(updatedCard.increase ?? 1);

        if ("damage" in updatedCard) {
          updatedCard.bonus.damage = (updatedCard.bonus.damage || 0) + inc;
        }
        if ("heal" in updatedCard) {
          updatedCard.bonus.heal = (updatedCard.bonus.heal || 0) + inc;
        }
        if ("damage_multiplier" in updatedCard) {
          updatedCard.bonus.damage_multiplier = parseFloat(
            ((updatedCard.bonus.damage_multiplier || 0) + inc).toFixed(3)
          );
        }
        if (Array.isArray(updatedCard.damage_over_time)) {
          const dot = [...updatedCard.damage_over_time];
          const baseSum = (originalDot || []).reduce(
            (sum, val) => sum + val,
            0
          );
          const dynamicInc = (baseSum / 100) * inc;

          if (dot.length < originalDotLength + 1) {
            dot.push(dynamicInc);
          } else {
            dot[originalDotLength] += dynamicInc;
          }

          updatedCard.damage_over_time = dot;
        }

        if (Array.isArray(updatedCard.damage_delayed)) {
          const base = updatedCard.damage_delayed[2] || 0;
          const incDelayed = Number(
            updatedCard.bonus?.damage_delayed_percent_increase ?? 0.1
          );
          updatedCard.damage_delayed[2] = +(base + incDelayed).toFixed(3);
          updatedCard.bonus.damage_delayed_percent =
            updatedCard.damage_delayed[2];
        }

        updatedCard.upgradeBonus = 0;
      } else {
        updatedCard.upgradeBonus = (updatedCard.upgradeBonus || 0) + 0.0025;
      }

      // Сохраняем обновления
      await rtdbUpdate(cardRef, updatedCard);
      await updateDoc(userRef, {
        balance: (userDoc.balance ?? 0) - upgradeCost,
        SecretRecipes: (userDoc.SecretRecipes ?? 0) - secretCost,
      });

      setAnimationSuccess(success);

      setTimeout(() => {
        setSelectedCard({ ...updatedCard, card_id: selectedCard.card_id });
        setPlayerCards((prev) =>
          prev.map((c) =>
            c.card_id === selectedCard.card_id
              ? { ...updatedCard, card_id: selectedCard.card_id }
              : c
          )
        );

        setUpgradeResult(success ? "success" : "fail");
        setLoadingUpgrade(false);
        setAnimating(false);
        setTimeout(() => setUpgradeResult(null), 2000);
        setAnimationSuccess(null);
      }, 2200);
    } catch (e) {
      console.error("Ошибка улучшения:", e);
      alert("Произошла ошибка при улучшении.");
      setLoadingUpgrade(false);
      setAnimating(false);
      setAnimationSuccess(null);
    }
  };

  const fusionCards = fusionSlots.filter(Boolean);
  const fusionBaseChance = fusionCards.length * 20;
  const fusionCharacteristic = fusionCards.length
    ? getCardCharacteristicType(fusionCards[0])
    : null;
  const fusionMaxBonus = Math.max(
    0,
    Math.min(100 - fusionBaseChance, secretBalance)
  );
  const fusionTotalChance = Math.min(100, fusionBaseChance + fusionBonus);

  useEffect(() => {
    if (fusionBonus > fusionMaxBonus) {
      setFusionBonus(fusionMaxBonus);
    }
  }, [fusionBonus, fusionMaxBonus]);

  const handleOpenFusionModal = (index) => {
    setFusionError("");
    setFusionSlotIndex(index);
    setShowFusionModal(true);
  };

  const handleRemoveFusionCard = (index) => {
    setFusionSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const handleFusionCardSelect = (card) => {
    if (fusionSlotIndex === null) return;
    const cardType = getCardCharacteristicType(card);
    if (fusionCharacteristic && cardType !== fusionCharacteristic) {
      setFusionError("Можно выбирать карты только с одним типом эффекта.");
      return;
    }
    if (fusionSlots.some((slot) => slot?.card_id === card.card_id)) {
      setFusionError("Эта карта уже выбрана.");
      return;
    }

    setFusionSlots((prev) => {
      const next = [...prev];
      next[fusionSlotIndex] = card;
      return next;
    });
    setShowFusionModal(false);
  };

  const handleFusionAttempt = async () => {
    if (!uid || fusionCards.length === 0 || fusionInProgress) return;

    setFusionError("");
    setFusionResult(null);
    setFusionInProgress(true);

    const baseChance = fusionCards.length * 20;
    const totalChance = Math.min(100, baseChance + fusionBonus);
    const firstCard = fusionCards[0];
    const currentRarity = normalizeRarity(firstCard.rarity);
    const rarityOrder = ["обычная", "редкая", "эпическая", "легендарная"];
    const currentIndex = rarityOrder.indexOf(currentRarity);
    const nextRarity =
      currentIndex >= 0 && currentIndex < rarityOrder.length - 1
        ? rarityOrder[currentIndex + 1]
        : null;

    if (!nextRarity) {
      setFusionError("Для слияния нужна карта не выше эпической редкости.");
      setFusionInProgress(false);
      return;
    }

    try {
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) throw new Error("Пользователь не найден.");
      const userDoc = userSnap.data();

      if ((userDoc.SecretRecipes ?? 0) < fusionBonus) {
        setFusionError("Недостаточно SecretRecipes для выбранного бонуса.");
        setFusionInProgress(false);
        return;
      }

      const success = Math.random() * 100 < totalChance;
      let newCardPayload = null;

      if (success) {
        const templatesSnap = await getDocs(collection(db, "cards"));
        const availableTemplates = [];
        templatesSnap.forEach((docSnap) => {
          const templateData = docSnap.data();
          const templateRarity = normalizeRarity(templateData.rarity);
          const templateType = getCardCharacteristicType(templateData);
          if (templateRarity === nextRarity && templateType === fusionCharacteristic) {
            availableTemplates.push({
              id: docSnap.id,
              data: templateData,
            });
          }
        });

        if (!availableTemplates.length) {
          throw new Error("Не найдено подходящих карт для слияния.");
        }

        const selectedTemplate =
          availableTemplates[
            Math.floor(Math.random() * availableTemplates.length)
          ];
        const newId = crypto.randomUUID();
        newCardPayload = {
          id: newId,
          data: selectedTemplate.data,
          templateId: selectedTemplate.id,
        };
      }

      const consumedIds = fusionCards.map((card) => card.card_id);
      const updatedCards = (userDoc.cards || []).filter(
        (id) => !consumedIds.includes(id)
      );
      const updatedRaid = (userDoc.deck_raid || []).filter(
        (id) => !consumedIds.includes(id)
      );
      const updatedPvp = (userDoc.deck_pvp || []).filter(
        (id) => !consumedIds.includes(id)
      );

      if (newCardPayload) {
        const { data, templateId, id } = newCardPayload;
        await rtdbSet(ref(database, `cards/${id}`), {
          ...data,
          lvl: 1,
          owner: uid,
          fleet: parseFloat(Math.random().toFixed(10)),
          sell: false,
          original_id: templateId,
          upgradeBonus: 0,
          increase: data.increase ?? 1,
        });
        updatedCards.push(id);
      }

      await updateDoc(userRef, {
        cards: updatedCards,
        deck_raid: updatedRaid,
        deck_pvp: updatedPvp,
        SecretRecipes: (userDoc.SecretRecipes ?? 0) - fusionBonus,
      });

      await Promise.all(
        consumedIds.map((cardId) =>
          rtdbRemove(ref(database, `cards/${cardId}`))
        )
      );

      setSecretBalance((prev) => Math.max(0, prev - fusionBonus));
      setPlayerCards((prev) => {
        const remaining = prev.filter(
          (card) => !consumedIds.includes(card.card_id)
        );
        if (newCardPayload) {
          const { data, id, templateId } = newCardPayload;
          remaining.push({
            ...data,
            card_id: id,
            original_id: templateId,
            lvl: 1,
            owner: uid,
            inRaid: false,
            inPvp: false,
            upgradeBonus: 0,
            increase: data.increase ?? 1,
          });
        }
        return remaining;
      });

      if (selectedCard && consumedIds.includes(selectedCard.card_id)) {
        setSelectedCard(null);
      }

      setFusionSlots(Array(5).fill(null));
      setFusionBonus(0);
      setFusionResult(success ? "success" : "fail");
    } catch (error) {
      console.error("Ошибка слияния:", error);
      setFusionError("Не удалось выполнить слияние.");
    } finally {
      setFusionInProgress(false);
      setTimeout(() => setFusionResult(null), 2000);
    }
  };

  const availableFusionCards = playerCards.filter((card) => {
    if (fusionSlots.some((slot) => slot?.card_id === card.card_id)) {
      return false;
    }
    if (fusionCharacteristic) {
      return getCardCharacteristicType(card) === fusionCharacteristic;
    }
    return true;
  });

  const renderCardDetails = (card) => {
    const details = [];

    if (card.random_value !== undefined)
      details.push(`Случайное значение: ${card.random_value}`);
    const bonus = card.bonus || {};
    if (card.damage !== undefined) {
      const total = card.damage + (bonus.damage || 0);
      details.push(`Урон: ${total} `);
    }

    if (card.heal !== undefined) {
      const total = card.heal + (bonus.heal || 0);
      details.push(`Лечение: ${total} `);
    }

    if (card.damage_multiplier !== undefined) {
      const total = card.damage_multiplier + (bonus.damage_multiplier || 0);
      details.push(`Множитель урона: x${total.toFixed(2)} `);
    }

    if (
      Array.isArray(card.damage_over_time) &&
      card.damage_over_time.length > 0
    ) {
      const dotString = card.damage_over_time.join("-");
      details.push(`Урон по ходам: ${dotString}`);
    }

    // Добавим отображение damage_delayed, если есть
    if (Array.isArray(card.damage_delayed)) {
      const delayedPercent = card.damage_delayed[2] || 0;
      details.push(`Задержанный урон: ${delayedPercent.toFixed(3)}`);
    }

    if (card.remove_multiplier) details.push(`Удаляет множитель`);

    return (
      <div className="card-details">
        {details.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    );
  };

  const renderPreviewCard = () => {
    if (!selectedCard) {
      return (
        <div className="empty-card">
          <div className="card-name">Предпросмотр</div>
        </div>
      );
    }

    const preview = {
      ...selectedCard,
      bonus: { ...(selectedCard.bonus || {}) },
      lvl: (selectedCard.lvl || 1) + 1,
    };

    const inc = Number(preview.increase) || 1;

    if ("damage" in preview)
      preview.bonus.damage = (preview.bonus.damage || 0) + inc;
    if ("heal" in preview) preview.bonus.heal = (preview.bonus.heal || 0) + inc;
    if ("damage_multiplier" in preview)
      preview.bonus.damage_multiplier =
        (preview.bonus.damage_multiplier || 0) + inc;

    // Условно формируем damage_over_time только если есть исходный массив с элементами
    if (
      Array.isArray(selectedCard.damage_over_time) &&
      selectedCard.damage_over_time.length > 0
    ) {
      const dot = [...selectedCard.damage_over_time];
      const templateDot = Array.isArray(selectedCard.templateDot)
        ? selectedCard.templateDot
        : [];
      const templateLength = templateDot.length;
      const baseSum = templateDot.reduce((sum, val) => sum + val, 0);
      const dynamicInc = (baseSum / 100) * inc;

      if (dot.length < templateLength + 1) {
        dot.push(dynamicInc);
      } else {
        dot[templateLength] += dynamicInc;
      }

      preview.damage_over_time = dot;
    } else {
      // Если damage_over_time нет — удаляем это поле, чтобы не отображалось
      delete preview.damage_over_time;
    }

    if (Array.isArray(preview.damage_delayed)) {
      const prev = preview.damage_delayed;
      const currPercent = prev[2] || 0;
      const incDelayed = preview.bonus?.damage_delayed_percent_increase || 0.1;
      preview.damage_delayed[2] = +(currPercent + incDelayed).toFixed(3);
    }

    return (
      <>
        <div className="card-name">{preview.name}</div>
        <div className="card-image-wrapper">
          <CachedImage src={preview.image_url} alt="preview" />
          {preview.lvl && (
            <div className="card-level-overlay">{toRoman(preview.lvl)}</div>
          )}
        </div>
        {renderCardDetails(preview)}
      </>
    );
  };

  return (
    <div
      className={`upgrade-container ${
        animationSuccess !== null
          ? animationSuccess
            ? "success-glow"
            : "fail-glow"
          : ""
      } ${activeTab === "fusion" ? "fusion-mode" : ""}`}
    >
      <div className="upgrade-title-wrapper">
        <h1 className="upgrade-title">
          {activeTab === "upgrade" ? "Повышение ранга" : "Слияние"}
        </h1>
        {activeTab === "upgrade" && (
          <button className="info-buttonU" onClick={() => setShowInfo(true)}>
            i
          </button>
        )}
      </div>

      <div className="tabs upgrade-tabs">
        <button
          className={`tab ${activeTab === "upgrade" ? "active" : ""}`}
          onClick={() => setActiveTab("upgrade")}
        >
          Прокачка
        </button>
        <button
          className={`tab ${activeTab === "fusion" ? "active" : ""}`}
          onClick={() => setActiveTab("fusion")}
        >
          Слияние
        </button>
      </div>

      {activeTab === "upgrade" && (
        <>
          <div
            className="upgrade-panel"
            style={{ display: "flex", alignItems: "center" }}
          >
            <div className="card-style">{renderPreviewCard()}</div>

            <div
              className="arrow-up"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                margin: "0 20px",
                position: "relative",
                fontSize: "40px",
                fontWeight: "bold",
                color: "#ffa500",
                WebkitTextStroke: "1px black",
                textShadow: `
                  -1px -1px 0 #000,
                   1px -1px 0 #000,
                  -1px  1px 0 #000,
                   1px  1px 0 #000
                `,
              }}
            >
              ↑
              <div
                className="success-rate"
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "100%",
                  transform: "translate(10px, -50%)",
                  fontWeight: "bold",
                  fontSize: "28px",
                  whiteSpace: "nowrap",
                  color: "#ffa500",
                  WebkitTextStroke: "1px black",
                  textShadow: `
          -1px -1px 0 #000,
          1px -1px 0 #000,
          -1px 1px 0 #000,
          1px 1px 0 #000
        `,
                }}
              >
                {selectedCard
                  ? Math.round(
                      getSuccessRate(
                        Number(selectedCard.lvl) || 1,
                        selectedCard.upgradeBonus || 0
                      ) * 100
                    ) + "%"
                  : ""}
              </div>
            </div>

            <div
              className={`card-style clickable
                  ${animating ? "upgrade-glow-pulse" : ""}
                  ${
                    animationSuccess === null && animating
                      ? "upgrade-glow-flicker"
                      : ""
                  }
                  ${animationSuccess === true ? "upgrade-success-glow" : ""}
                  ${animationSuccess === false ? "upgrade-fail-shake-glow" : ""}
                `}
              style={{ position: "relative" }}
              onClick={() => setShowCardModal(true)}
            >
              {animating && <div className="upgrade-mystic-fog" />}
              {selectedCard ? (
                <>
                  <div className="card-name">{selectedCard.name}</div>
                  <div className="card-image-wrapper">
                    <CachedImage src={selectedCard.image_url} alt="selected" />
                    {selectedCard.lvl && (
                      <div className="card-level-overlay">
                        {toRoman(selectedCard.lvl)}
                      </div>
                    )}
                  </div>
                  {renderCardDetails(selectedCard)}
                </>
              ) : (
                <div className="empty-card">
                  <div className="card-name">Выберите карту</div>
                </div>
              )}
            </div>
          </div>

          <button
            className="upgrade-button"
            onClick={upgradeSelectedCard}
            disabled={!selectedCard || loadingUpgrade || animating}
          >
            {loadingUpgrade ? (
              "Улучшение..."
            ) : selectedCard ? (
              <span
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span>{(selectedCard.lvl || 1) * 100}</span>
                <img
                  src="moneta.png"
                  alt="coin"
                  style={{ width: 20, height: 20 }}
                />
                <span>+</span>
                <span>{Math.max(0, (selectedCard.lvl || 1) - 1)}</span>
                <img
                  src="666666.png"
                  alt="secret"
                  style={{ width: 20, height: 20 }}
                />
              </span>
            ) : (
              "Улучшить"
            )}
          </button>

          {upgradeResult === "success" && (
            <div className="upgrade-result upgrade-success"></div>
          )}
          {upgradeResult === "fail" && (
            <div className="upgrade-result upgrade-failure"></div>
          )}
        </>
      )}

      {activeTab === "fusion" && (
        <div className="fusion-panel">
          <p className="fusion-hint">
            Выберите до 5 карт с одинаковым типом эффекта, чтобы попытаться
            повысить редкость.
          </p>
          <div className="fusion-slots">
            {fusionSlots.map((slot, index) => (
              <div key={index} className="fusion-slot">
                {slot ? (
                  <>
                    <CachedImage
                      src={slot.image_url}
                      alt={slot.name}
                      className="fusion-slot-image"
                    />
                    <div className="fusion-slot-name">{slot.name}</div>
                    <button
                      className="fusion-slot-remove"
                      onClick={() => handleRemoveFusionCard(index)}
                      type="button"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <button
                    className="fusion-slot-add"
                    onClick={() => handleOpenFusionModal(index)}
                    type="button"
                  >
                    +
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="fusion-stats">
            <div>
              Тип эффекта:{" "}
              <strong>
                {fusionCharacteristic
                  ? characteristicLabels[fusionCharacteristic]
                  : "не выбран"}
              </strong>
            </div>
            <div>
              Базовый шанс: <strong>{fusionBaseChance}%</strong>
            </div>
            <div>
              Итоговый шанс: <strong>{fusionTotalChance}%</strong>
            </div>
          </div>

          <div className="fusion-slider">
            <div className="fusion-slider-label">
              Бонус SecretRecipes: <strong>{fusionBonus}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max={fusionMaxBonus}
              value={fusionBonus}
              onChange={(event) =>
                setFusionBonus(Number(event.target.value))
              }
            />
            <div className="fusion-slider-meta">
              Доступно: {secretBalance} | Потратится: {fusionBonus}
            </div>
          </div>

          {fusionError && <div className="fusion-error">{fusionError}</div>}
          {fusionResult === "success" && (
            <div className="fusion-result success">
              Слияние успешно! Карта стала более редкой.
            </div>
          )}
          {fusionResult === "fail" && (
            <div className="fusion-result fail">
              Неудача. Карты исчезли без результата.
            </div>
          )}

          <button
            className="upgrade-button fusion-button"
            onClick={handleFusionAttempt}
            disabled={fusionCards.length === 0 || fusionInProgress}
          >
            {fusionInProgress ? "Попытка..." : "Попытать удачу"}
          </button>
        </div>
      )}
      {showInfo && (
        <div
          className="modal-overlay"
          onClick={() => setShowInfo(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start", // чтобы окно можно было сместить
            paddingTop: "24vh", // регулируешь смещение вниз/вверх
            zIndex: 1000,
          }}
        >
          <div
            className="modal-window"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#2e2e2e",
              padding: "10px",
              borderRadius: "8px",
              maxWidth: "500px",
              width: "96%", // ширина окна
              height: "67vh", // 70% высоты экрана
              overflowY: "auto", // прокрутка при переполнении
              color: "#fff",
            }}
          >
            <div>{infoContent}</div>
          </div>
        </div>
      )}

      {showCardModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCardModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="card-modal-content-upgrade"
            onClick={(e) => e.stopPropagation()} // предотвращаем закрытие при клике по самому окну
            style={{
              maxHeight: "80vh",
            }}
          >
            <div className="card-list">
              {playerCards.map((card) => (
                <div
                  className="card-style clickable"
                  key={card.card_id}
                  onClick={() => handleCardSelect(card)}
                >
                  <div className="card-name">{card.name}</div>
                  <CachedImage src={card.image_url} alt={card.name} />
                  {renderCardDetails(card)}

                  {(card.inRaid || card.inPvp) && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: "14px",
                        color: "#ffa500",
                        fontStyle: "italic",
                      }}
                    >
                      В колоде {card.inRaid ? "(Рейд)" : ""}{" "}
                      {card.inPvp ? "(ПвП)" : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showFusionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowFusionModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="card-modal-content-upgrade"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "80vh",
            }}
          >
            <div className="fusion-modal-header">
              <span>
                {fusionCharacteristic
                  ? `Тип: ${characteristicLabels[fusionCharacteristic]}`
                  : "Выберите первую карту"}
              </span>
              <button
                className="fusion-modal-close"
                onClick={() => setShowFusionModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="card-list">
              {availableFusionCards.map((card) => (
                <div
                  className="card-style clickable"
                  key={card.card_id}
                  onClick={() => handleFusionCardSelect(card)}
                >
                  <div className="card-name">{card.name}</div>
                  <CachedImage src={card.image_url} alt={card.name} />
                  {renderCardDetails(card)}

                  {(card.inRaid || card.inPvp) && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: "14px",
                        color: "#ffa500",
                        fontStyle: "italic",
                      }}
                    >
                      В колоде {card.inRaid ? "(Рейд)" : ""}{" "}
                      {card.inPvp ? "(ПвП)" : ""}
                    </div>
                  )}
                </div>
              ))}
              {availableFusionCards.length === 0 && (
                <div className="fusion-empty">
                  Нет подходящих карт для слияния.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UpgradePage;
