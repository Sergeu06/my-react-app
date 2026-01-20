const readForcedLowEnd = () => {
  try {
    return window.localStorage.getItem("forceLowEndMode");
  } catch (error) {
    return null;
  }
};

const getConnection = () =>
  navigator.connection || navigator.mozConnection || navigator.webkitConnection;

export const detectLowEndDevice = () => {
  const forced = readForcedLowEnd();
  if (forced === "1") return true;
  if (forced === "0") return false;

  const connection = getConnection();
  const effectiveType = connection?.effectiveType || "";
  const saveData = connection?.saveData === true;

  const lowNetwork =
    effectiveType.includes("slow-2g") ||
    effectiveType.includes("2g") ||
    effectiveType.includes("3g");

  const deviceMemory = navigator.deviceMemory || null;
  const lowMemory = deviceMemory !== null && deviceMemory <= 2;

  const cpuCores = navigator.hardwareConcurrency || null;
  const lowCpu = cpuCores !== null && cpuCores <= 4;

  return saveData || lowNetwork || lowMemory || lowCpu;
};
