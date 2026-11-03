/**
 * Prices are kept as whole cents so nothing is ever $24.989999.
 *
 * Only US dollars for now: the parser reads "1,299.99" the American way, and
 * the formatter prints dollars. A list owner types or confirms every price, so
 * a store that reports another currency is caught by a person before it shows.
 */

const MAX_CENTS = 100_000_000;

/** "$1,299.99", "24", 24.5 or "USD 30" to cents. Null when it is not a price. */
export function parsePrice(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let value: number;
  if (typeof input === "number") {
    value = input;
  } else {
    const match = input.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    if (!match) return null;
    value = Number(match[0]);
  }
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return cents <= MAX_CENTS ? cents : null;
}

/** 2500 to "$25", 2499 to "$24.99". */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** The value a price input starts with: "24.99", "25", or empty. */
export function priceInputValue(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
