export const PREFIXES = [
  { symbol: "pg", name: "picogram", prefix: "pico", exp: -12 },
  { symbol: "ng", name: "nanogram", prefix: "nano", exp: -9 },
  { symbol: "μg", name: "microgram", prefix: "micro", exp: -6 },
  { symbol: "mg", name: "milligram", prefix: "milli", exp: -3 },
  { symbol: "g", name: "gram", prefix: "none", exp: 0 },
  { symbol: "kg", name: "kilogram", prefix: "kilo", exp: 3 },
  { symbol: "Mg", name: "megagram", prefix: "mega", exp: 6 },
  { symbol: "Gg", name: "gigagram", prefix: "giga", exp: 9 },
];

export const LEVELS = {
  foundations: ["mg", "g", "kg", "Gg"],
  standard: ["μg", "mg", "g", "kg", "Mg", "Gg"],
  challenge: PREFIXES.map((item) => item.symbol),
};

const VALUES = [1.194, 2.5, 3.72, 4.58, 6.04, 7.65, 8.2, 9.01];

export function getUnit(symbol) {
  return PREFIXES.find((item) => item.symbol === symbol);
}

export function generateConversion(level = "foundations", guided = true) {
  const allowed = LEVELS[level] || LEVELS.foundations;
  let choices = allowed.map(getUnit);
  if (guided) choices = choices.filter((unit) => unit.exp !== 0);
  const start = choices[Math.floor(Math.random() * choices.length)];
  let target = choices[Math.floor(Math.random() * choices.length)];
  while (target.symbol === start.symbol) {
    target = choices[Math.floor(Math.random() * choices.length)];
  }
  const value = VALUES[Math.floor(Math.random() * VALUES.length)];
  return makeConversion(value, start.symbol, target.symbol);
}

export function makeConversion(value, startSymbol, targetSymbol) {
  const start = getUnit(startSymbol);
  const target = getUnit(targetSymbol);
  return {
    value,
    start,
    target,
    resultExp: start.exp - target.exp,
  };
}

export function exponentOptions(correct) {
  const pool = new Set([correct, -correct, correct + 3, correct - 3, correct + 6]);
  return [...pool].slice(0, 4).sort(() => Math.random() - 0.5);
}

export function decimalFromScientific(coefficient, exponent) {
  const coefficientText = String(coefficient);
  const negative = coefficientText.startsWith("-");
  const clean = coefficientText.replace("-", "");
  const [whole, fraction = ""] = clean.split(".");
  const digits = whole + fraction;
  const originalPoint = whole.length;
  const newPoint = originalPoint + exponent;
  let output;

  if (newPoint <= 0) {
    output = `0.${"0".repeat(Math.abs(newPoint))}${digits}`;
  } else if (newPoint >= digits.length) {
    output = `${digits}${"0".repeat(newPoint - digits.length)}`;
  } else {
    output = `${digits.slice(0, newPoint)}.${digits.slice(newPoint)}`;
  }

  output = output.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return negative ? `-${output}` : output;
}

export function generateNotation() {
  const coefficient = VALUES[Math.floor(Math.random() * VALUES.length)];
  let exponent = Math.floor(Math.random() * 19) - 9;
  if (exponent === 0) exponent = 5;
  const direction = Math.random() > 0.5 ? "toStandard" : "toScientific";
  return {
    coefficient,
    exponent,
    direction,
    standard: decimalFromScientific(coefficient, exponent),
  };
}

export function nearlyEqual(a, b) {
  const first = Number(a);
  const second = Number(b);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return false;
  return Math.abs(first - second) <= Math.max(1e-14, Math.abs(second) * 1e-9);
}

export function formatExponent(exp) {
  return exp < 0 ? `−${Math.abs(exp)}` : String(exp);
}

export function magnitudeCheck(problem) {
  if (problem.target.exp > problem.start.exp) {
    return `You are changing ${problem.start.symbol} into a larger unit, ${problem.target.symbol}, so the number must get smaller.`;
  }
  return `You are changing ${problem.start.symbol} into a smaller unit, ${problem.target.symbol}, so the number must get larger.`;
}
