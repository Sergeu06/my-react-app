//game/strikeAnimations.js

const ts = () => new Date().toISOString();

const makeLog = (tag = "strikeSequence") => ({
  info: (msg, ...args) => console.log(`${ts()} [${tag}] ℹ ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`${ts()} [${tag}] ⚠ ${msg}`, ...args),
  error: (msg, err) => console.error(`${ts()} [${tag}] ✖ ${msg}`, err || ""),
});

export const getCenter = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export const waitAnimationEnd = (el, animationName = "card-break") =>
  new Promise((resolve) => {
    const onEnd = (e) => {
      if (
        e.animationName === animationName ||
        (animationName === "card-break" &&
          e.animationName === "card-heal-flight")
      ) {
        el.removeEventListener("animationend", onEnd);
        resolve();
      }
    };
    el.addEventListener("animationend", onEnd);
  });

export const popAvatar = (avatarEl) => {
  if (!avatarEl) return;
  avatarEl.classList.remove("avatar-hit");
  void avatarEl.offsetHeight;
  avatarEl.classList.add("avatar-hit");
};

const waitForCardEl = (
  row,
  cardId,
  { intervalMs = 100, timeoutMs = 1200 } = {}
) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const tryFind = () => {
      const el = row.querySelector(`.played-card-wrapper[data-id="${cardId}"]`);
      if (el) return resolve(el);
      if (Date.now() - start >= timeoutMs)
        return reject(
          new Error(`Карта ${cardId} не появилась в DOM за ${timeoutMs}ms`)
        );
      setTimeout(tryFind, intervalMs);
    };
    tryFind();
  });

export const showDamageNumber = (
  avatarEl,
  damage,
  { direction = "bottom", isHeal = false } = {}
) => {
  if (!avatarEl || !Number.isFinite(damage) || damage <= 0) return;

  const dmgEl = document.createElement("div");
  const directionClass =
    direction === "top" ? "damage-number-down" : "damage-number-up";
  const value = Math.abs(Math.round(damage));
  dmgEl.className = `damage-number ${directionClass}`;
  dmgEl.textContent = `${isHeal ? "+" : "-"}${value}`;

  const container = avatarEl.closest(".avatar-wrapper") ?? avatarEl.parentElement;
  if (!container) return;
  container.appendChild(dmgEl);

  setTimeout(() => dmgEl.remove(), 800);
};

/**
 * Анимация карты: обычный удар, лечение или DoT
 */
export const strikeSequence = async (
  side,
  targetAvatarPos,
  lobbyId,
  ownerUid,
  database,
  cardId,
  deleteIfOwner = false,
  onDamageFlash = null,
  onDamageCommit = null,
  damage = null,
  delayMs = 1000,
  damageDelayMs = 450,
  isHeal = false,
  isDot = false
) => {
  const log = makeLog(
    `strike[lobby=${lobbyId}][owner=${ownerUid}][card=${cardId}]`
  );
  log.info("Запуск strikeSequence", {
    side,
    targetAvatarPos,
    cardId,
    isHeal,
    isDot,
  });

  const row = document.querySelector(`.board-row.${side}`);
  const avatar = document.querySelector(
    `.player-avatar[data-position="${targetAvatarPos}"]`
  );
  if (!row || !avatar)
    return log.warn("row или avatar не найдены", {
      rowFound: !!row,
      avatarFound: !!avatar,
    });

  let animateEl;
  try {
    animateEl = await waitForCardEl(row, cardId);
  } catch (err) {
    return log.error(`карта ${cardId} не найдена в DOM`, err);
  }

  try {
    const ownerPos = side === "player" ? "bottom" : "top";
    const ownerAvatar = document.querySelector(
      `.player-avatar[data-position="${ownerPos}"]`
    );
    const aC = getCenter(isHeal ? ownerAvatar : avatar);
    const cC = getCenter(animateEl);

    animateEl.style.setProperty("--dx", `${aC.x - cC.x}px`);
    animateEl.style.setProperty("--dy", `${aC.y - cC.y}px`);
    animateEl.style.setProperty(
      "--rot",
      `${(Math.random() * 12 - 6).toFixed(1)}deg`
    );

    animateEl.classList.remove("card-heal", "card-dot-strike", "card-strike");
    void animateEl.offsetHeight;

    let chosenAnim = "card-break";
    if (isHeal) {
      chosenAnim = "card-heal-flight";
      animateEl.classList.add("card-heal");
    } else if (isDot) {
      chosenAnim = "card-dot-strike";
      animateEl.classList.add("card-dot-strike");
      log.info("DoT карта — выполняем анимацию полёта", { cardId });
    } else {
      chosenAnim = "card-break";
      animateEl.classList.add("card-strike");
    }

    setTimeout(() => {
      onDamageFlash?.();
      onDamageCommit?.();
      if (damage !== null) {
        showDamageNumber(avatar, damage, {
          direction: targetAvatarPos,
          isHeal,
        });
      }
      if (isDot) log.info("DoT тик нанесён", { cardId, damage });
    }, damageDelayMs);

    await waitAnimationEnd(animateEl, chosenAnim);

    if (!isDot) popAvatar(avatar);

    if (!isDot) {
      animateEl.classList.add("card-hidden-after-anim");
      animateEl.style.visibility = "hidden";
      animateEl.style.pointerEvents = "none";
      animateEl.style.opacity = "0";
    } else {
      log.info("DoT карта остаётся на поле", { cardId });
    }

    animateEl.classList.remove("card-heal", "card-dot-strike", "card-strike");
    await new Promise((res) => setTimeout(res, delayMs));

    log.info("strikeSequence завершён успешно", cardId);
  } catch (err) {
    log.error("Ошибка в strikeSequence", err);
  }
};
