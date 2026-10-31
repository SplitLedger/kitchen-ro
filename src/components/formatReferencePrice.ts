export function formatMoney(amount: number, currencyLabel: string): string {
  return `${amount} ${currencyLabel}`;
}

export function formatUnitValue(amount: number | null, currencyLabel: string): string {
  if (amount === null) {
    return "Not set";
  }
  return formatMoney(amount, currencyLabel);
}

export function formatPriceRange(
  minimum: number | null | undefined,
  maximum: number | null | undefined,
  currencyLabel: string,
): string {
  if (minimum == null || maximum == null) {
    return "Not set";
  }
  if (minimum === maximum) {
    return formatMoney(minimum, currencyLabel);
  }
  return `${minimum}–${maximum} ${currencyLabel}`;
}

export function formatReferencePrice(price: number | null, currencyLabel: string): string {
  if (price === null) {
    return "-";
  }
  return formatMoney(price, currencyLabel);
}
