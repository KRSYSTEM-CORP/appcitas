// A service's price is stored in whatever currency it was entered in
// (Service.priceCurrencyCode) — usually the business's stable reference
// currency (USD/EUR) rather than a volatile local currency like VES. This
// converts it to the business's local currency for display/charging, using
// Business.exchangeRate. Returns null when it can't be converted
// (currency mismatch with no rate available) — callers should fall back to
// showing the raw reference-currency price in that case.
export function serviceLocalPriceCents(
  service: { basePriceCents: number; priceCurrencyCode: string },
  business: { localCurrencyCode: string },
  rate: number | null,
): number | null {
  if (service.priceCurrencyCode === business.localCurrencyCode) return service.basePriceCents;
  if (rate == null || rate <= 0) return null;
  // rate is "1 unit of the reference currency = `rate` units of local
  // currency" (see ExchangeRateForm) — cents scale consistently on both
  // sides, so this multiplication works directly in cents.
  return Math.round(service.basePriceCents * rate);
}
