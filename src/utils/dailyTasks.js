import { format } from "date-fns";
import { get, databaseRef, set, update } from "../components/firebase";

export const DAILY_TASK_IDS = [
  "daily_duel",
  "daily_raid",
  "daily_upgrade",
  "daily_shop",
  "daily_collection",
];

export const getTodayKey = () => format(new Date(), "yyyy-MM-dd");

export const buildDailyTaskDefaults = (taskIds) =>
  taskIds.reduce((acc, id) => {
    acc[id] = { completed: false, claimed: false };
    return acc;
  }, {});

export const buildDailyBonusDefaults = () => ({
  bonus3: { claimed: false },
  bonus5: { claimed: false },
});

export const ensureDailyTasks = async (database, uid, taskIds) => {
  const todayKey = getTodayKey();
  const tasksRef = databaseRef(database, `users/${uid}/settings/dailyTasks`);
  const snapshot = await get(tasksRef);
  const defaultTasks = buildDailyTaskDefaults(taskIds);
  const defaultBonus = buildDailyBonusDefaults();

  if (!snapshot.exists()) {
    const payload = { date: todayKey, tasks: defaultTasks, bonus: defaultBonus };
    await set(tasksRef, payload);
    return payload;
  }

  const data = snapshot.val() || {};
  if (data.date !== todayKey) {
    const payload = { date: todayKey, tasks: defaultTasks, bonus: defaultBonus };
    await set(tasksRef, payload);
    return payload;
  }

  const tasks = { ...defaultTasks, ...(data.tasks || {}) };
  const bonus = { ...defaultBonus, ...(data.bonus || {}) };
  if (Object.keys(tasks).length !== Object.keys(data.tasks || {}).length) {
    await update(tasksRef, { tasks });
  }
  if (Object.keys(bonus).length !== Object.keys(data.bonus || {}).length) {
    await update(tasksRef, { bonus });
  }

  return { date: todayKey, tasks, bonus };
};

export const completeDailyTask = async (database, uid, taskIds, taskId) => {
  const data = await ensureDailyTasks(database, uid, taskIds);
  if (!data.tasks?.[taskId]?.completed) {
    await update(
      databaseRef(database, `users/${uid}/settings/dailyTasks/tasks/${taskId}`),
      { completed: true }
    );
  }
};

export const claimDailyTask = async (database, uid, taskIds, taskId) => {
  const data = await ensureDailyTasks(database, uid, taskIds);
  if (!data.tasks?.[taskId]?.claimed) {
    await update(
      databaseRef(database, `users/${uid}/settings/dailyTasks/tasks/${taskId}`),
      { claimed: true }
    );
  }
};

export const claimDailyTaskBonus = async (
  database,
  uid,
  taskIds,
  bonusKey
) => {
  const data = await ensureDailyTasks(database, uid, taskIds);
  if (!data.bonus?.[bonusKey]?.claimed) {
    await update(
      databaseRef(database, `users/${uid}/settings/dailyTasks/bonus/${bonusKey}`),
      { claimed: true }
    );
  }
};
