import "server-only";

// Venezuela's official BCV (Banco Central de Venezuela) rate, via
// ve.dolarapi.com — a free public aggregator that republishes BCV's own
// daily-published rate (BCV itself has no public API). Used both by the
// manual "Actualizar con tasa BCV" button (lib/actions/business.ts) and the
// daily cron job (app/api/cron/bcv-rate/route.ts) that refreshes every
// FX-enabled business automatically.
export async function fetchBcvRate(currency: "USD" | "EUR"): Promise<number> {
  const path = currency === "USD" ? "dolares" : "euros";
  const res = await fetch(`https://ve.dolarapi.com/v1/${path}/oficial`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("No se pudo consultar la tasa del BCV");
  }
  const json = await res.json();
  const rate = Number(json.promedio);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("La tasa del BCV recibida no es válida");
  }
  return rate;
}
