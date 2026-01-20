import { useEffect, useState } from "react";

const getVisibilityState = () =>
  typeof document !== "undefined" ? document.visibilityState : "visible";

const buildIsActive = (isTransitioning) =>
  getVisibilityState() === "visible" && !isTransitioning;

export const usePageActivity = ({ isTransitioning = false } = {}) => {
  const [isActive, setIsActive] = useState(buildIsActive(isTransitioning));

  useEffect(() => {
    const handleVisibility = () => {
      setIsActive(buildIsActive(isTransitioning));
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isTransitioning]);

  useEffect(() => {
    setIsActive(buildIsActive(isTransitioning));
  }, [isTransitioning]);

  return isActive;
};
