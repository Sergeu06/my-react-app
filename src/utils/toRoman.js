export function toRoman(num) {
  if (typeof num !== "number" || num <= 0) return "";
  const romanMap = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];

  return romanMap.reduce((acc, [val, sym]) => {
    while (num >= val) {
      acc += sym;
      num -= val;
    }
    return acc;
  }, "");
}
