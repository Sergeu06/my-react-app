import { differenceInSeconds, startOfTomorrow } from "date-fns";

const RAID_EVENTS = [
  {
    id: "burning-enemies",
    title: "Пламя рассвета",
    description: "Следующий рейд: все враги горят",
    modifiers: { burnBonus: 0.1 },
  },
  {
    id: "cost-up",
    title: "Налог арсенала",
    description: "Карты стоят на +25%",
    modifiers: { costMultiplier: 1.25 },
  },
  {
    id: "cost-down",
    title: "Скидка кузницы",
    description: "Карты стоят на -25%",
    modifiers: { costMultiplier: 0.75 },
  },
  {
    id: "energy-up",
    title: "Переполненные батареи",
    description: "В этом бою энергии на 50%",
    modifiers: { energyMultiplier: 1.5 },
  },
  {
    id: "energy-down",
    title: "Сбой реакторов",
    description: "В этом бою энергии на -25%",
    modifiers: { energyMultiplier: 0.75 },
  },
  {
    id: "damage-up",
    title: "Ярость охотников",
    description: "В этом бою урон +50%",
    modifiers: { damageMultiplier: 1.5 },
  },
  {
    id: "echo-play",
    title: "Эхо колоды",
    description: "При разыгровке карты 50% шанс, что разыграется другая карта",
    modifiers: { extraPlayChance: 0.5 },
  },
];

export const getRaidEventInfo = (date = new Date()) => {
  const event = RAID_EVENTS[date.getDay()];
  const nextChange = startOfTomorrow();
  const secondsRemaining = Math.max(
    0,
    differenceInSeconds(nextChange, date)
  );

  return { event, secondsRemaining, nextChange };
};

export const formatRaidCountdown = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const applyRaidModifiers = (event, base) => {
  if (!event?.modifiers) return base;
  const { modifiers } = event;
  return {
    energyMultiplier: modifiers.energyMultiplier ?? base.energyMultiplier,
    costMultiplier: modifiers.costMultiplier ?? base.costMultiplier,
    damageMultiplier: modifiers.damageMultiplier ?? base.damageMultiplier,
    extraPlayChance: modifiers.extraPlayChance ?? base.extraPlayChance,
    burnBonus: modifiers.burnBonus ?? base.burnBonus,
  };
};
