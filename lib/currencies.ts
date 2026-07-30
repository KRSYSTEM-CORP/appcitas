// Ported from the ventas-inventario app's lib/currencies.ts so both apps
// offer the same local-currency picker (Settings → Moneda). Used for the
// picker list/labels and for formatting the raw exchange-rate number
// (formatMoney in lib/format.ts handles cents-based money elsewhere).
export type CurrencyOption = {
  code: string; // ISO 4217
  name: string;
  symbol: string;
  locale: string; // drives thousands/decimal separator conventions
};

export const CURRENCIES: CurrencyOption[] = [
  { code: "VES", name: "Bolívares (Venezuela)", symbol: "Bs.", locale: "es-VE" },
  { code: "USD", name: "Dólares (Estados Unidos)", symbol: "US$", locale: "en-US" },
  { code: "MXN", name: "Pesos (México)", symbol: "$", locale: "es-MX" },
  { code: "COP", name: "Pesos (Colombia)", symbol: "$", locale: "es-CO" },
  { code: "PEN", name: "Soles (Perú)", symbol: "S/", locale: "es-PE" },
  { code: "ARS", name: "Pesos (Argentina)", symbol: "$", locale: "es-AR" },
  { code: "CLP", name: "Pesos (Chile)", symbol: "$", locale: "es-CL" },
  { code: "BRL", name: "Reales (Brasil)", symbol: "R$", locale: "pt-BR" },
  { code: "DOP", name: "Pesos (República Dominicana)", symbol: "RD$", locale: "es-DO" },
  { code: "GTQ", name: "Quetzales (Guatemala)", symbol: "Q", locale: "es-GT" },
  { code: "HNL", name: "Lempiras (Honduras)", symbol: "L", locale: "es-HN" },
  { code: "NIO", name: "Córdobas (Nicaragua)", symbol: "C$", locale: "es-NI" },
  { code: "CRC", name: "Colones (Costa Rica)", symbol: "₡", locale: "es-CR" },
  { code: "PAB", name: "Balboas (Panamá)", symbol: "B/.", locale: "es-PA" },
  { code: "UYU", name: "Pesos (Uruguay)", symbol: "$U", locale: "es-UY" },
  { code: "PYG", name: "Guaraníes (Paraguay)", symbol: "₲", locale: "es-PY" },
  { code: "BOB", name: "Bolivianos (Bolivia)", symbol: "Bs", locale: "es-BO" },
  { code: "EUR", name: "Euros", symbol: "€", locale: "de-DE" },
  { code: "GBP", name: "Libras esterlinas", symbol: "£", locale: "en-GB" },
];

export const DEFAULT_CURRENCY_CODE = "VES";

export function getCurrency(code: string | null | undefined): CurrencyOption {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

// Formats a raw amount (not cents) with the currency's own symbol/locale —
// used for the exchange rate value itself, which is a plain decimal number
// rather than a stored cents amount.
export function formatLocalCurrency(amount: number, currencyCode: string | null | undefined): string {
  const currency = getCurrency(currencyCode);
  const formatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency.symbol} ${formatted}`;
}
