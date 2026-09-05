export const MONEY_SCALE = 100;

function parseDecimal(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const sign = match[1] === "-" ? -1n : 1n;
  const integer = match[2];
  const fraction = match[3] || "";
  const exponent = Number(match[4] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) return null;
  return { sign, digits: BigInt(`${integer}${fraction}`), scale: fraction.length - exponent };
}

export function toMinor(value, fallback = 0) {
  const parsed = parseDecimal(value);
  if (!parsed) return fallback;
  let minor;
  const shift = 2 - parsed.scale;
  if (shift >= 0) {
    minor = parsed.digits * (10n ** BigInt(shift));
  } else {
    const divisor = 10n ** BigInt(-shift);
    const quotient = parsed.digits / divisor;
    const remainder = parsed.digits % divisor;
    minor = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }
  minor *= parsed.sign;
  const number = Number(minor);
  return Number.isSafeInteger(number) ? number : fallback;
}

export function fromMinor(value, fallback = 0) {
  const minor = Number(value);
  return Number.isSafeInteger(minor) ? minor / MONEY_SCALE : fallback;
}

export function readMinor(record, field = "amount", fallback = 0) {
  const minor = Number(record?.[`${field}Minor`]);
  return Number.isSafeInteger(minor) ? minor : toMinor(record?.[field], fallback);
}

export function writeMoney(record, field, value) {
  const minor = toMinor(value);
  record[field] = fromMinor(minor);
  record[`${field}Minor`] = minor;
  return record[field];
}

export function moneyFields(value, minorValue, fallback = 0) {
  const providedMinor = Number(minorValue);
  const minor = Number.isSafeInteger(providedMinor) ? providedMinor : toMinor(value, fallback);
  return { value: fromMinor(minor), minor };
}

export function convertMinor(minor, rate = 1) {
  const numericRate = Number(rate);
  if (!Number.isSafeInteger(minor) || !Number.isFinite(numericRate)) return 0;
  const converted = Math.round(minor * numericRate);
  if (!Number.isSafeInteger(converted)) throw new Error("金额或汇率超出支持范围");
  return converted;
}
