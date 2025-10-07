import React, { useState, useEffect } from "react";

function NavTimer({ startTimestamp }) {
  const [secondsElapsed, setSecondsElapsed] = useState(
    startTimestamp ? Math.floor((Date.now() - startTimestamp) / 1000) : 0
  );

  useEffect(() => {
    if (!startTimestamp) return; // если таймер не активен, ничего не делаем

    const interval = setInterval(() => {
      setSecondsElapsed(Math.floor((Date.now() - startTimestamp) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTimestamp]);

  // функция форматирования времени в mm:ss
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return <span>{formatTime(secondsElapsed)}</span>;
}

export default NavTimer;
