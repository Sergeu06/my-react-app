import { createContext, useContext } from "react";

const PerformanceContext = createContext({
  lowEndMode: false,
  isTransitioning: false,
});

export const PerformanceProvider = PerformanceContext.Provider;

export const usePerformance = () => useContext(PerformanceContext);
