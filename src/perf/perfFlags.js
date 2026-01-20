import { detectLowEndDevice } from "./detectLowEndDevice";

let lowEndMode = detectLowEndDevice();

export const getLowEndMode = () => lowEndMode;

export const setLowEndMode = (nextValue) => {
  lowEndMode = Boolean(nextValue);
};
