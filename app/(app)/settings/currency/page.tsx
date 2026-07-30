import { getBusinessConfig } from "@/lib/actions/business";
import { ReferenceCurrencyForm } from "@/components/settings/ReferenceCurrencyForm";
import { CurrencySelectForm } from "@/components/settings/CurrencySelectForm";
import { ExchangeRateForm } from "@/components/settings/ExchangeRateForm";
import { BcvRateButton } from "@/components/settings/BcvRateButton";
import { formatDate } from "@/lib/format";
import { formatLocalCurrency } from "@/lib/currencies";

const RATE_TIME_ZONE = "America/Caracas";

function zonedDateParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    instant,
  );
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function isStale(updatedAt: Date | null): boolean {
  if (!updatedAt) return true;
  const today = zonedDateParts(new Date(), RATE_TIME_ZONE);
  const updated = zonedDateParts(updatedAt, RATE_TIME_ZONE);
  return !(today.year === updated.year && today.month === updated.month && today.day === updated.day);
}

export default async function CurrencySettingsPage() {
  const business = await getBusinessConfig();
  const stale = isStale(business.currentRateUpdatedAt);
  const referenceSymbol = business.foreignCurrencyCode === "USD" ? "$1" : "€1";

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Moneda y tasa de cambio</h2>

      <ReferenceCurrencyForm currentEnabled={business.fxEnabled} currentReferenceCurrency={business.foreignCurrencyCode} />

      {business.fxEnabled && (
        <>
          <hr className="border-border" />

          <CurrencySelectForm
            currentCurrencyCode={business.localCurrencyCode}
            referenceCurrency={business.foreignCurrencyCode}
          />

          <div className="rounded-lg border border-border p-4 flex flex-col gap-1 max-w-sm">
            <span className="text-sm text-muted-foreground">Tasa actual</span>
            <span className="text-2xl font-semibold">
              {business.currentRate != null ? formatLocalCurrency(business.currentRate, business.localCurrencyCode) : "No configurada"}
              {business.currentRate != null && (
                <span className="text-sm text-muted-foreground font-normal"> / {referenceSymbol}</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {business.currentRateUpdatedAt
                ? `Última actualización: ${formatDate(business.currentRateUpdatedAt)}`
                : "Nunca se ha configurado"}
            </span>
          </div>

          {stale && (
            <p className="text-sm text-destructive max-w-sm">
              {business.currentRate != null
                ? "No has actualizado la tasa hoy. Los precios en tu moneda local pueden estar desactualizados."
                : "Configura una tasa para poder ver precios en tu moneda local y completar citas."}
            </p>
          )}

          {business.localCurrencyCode === "VES" && (
            <p className="text-xs text-muted-foreground max-w-sm">
              Se actualiza sola todos los días con la tasa oficial del BCV. También puedes hacerlo tú mismo, o
              escribirla a mano abajo.
            </p>
          )}
          {business.localCurrencyCode === "VES" && <BcvRateButton currency={business.foreignCurrencyCode} />}

          <ExchangeRateForm
            currentRate={business.currentRate}
            currencyCode={business.localCurrencyCode}
            foreignCurrencyCode={business.foreignCurrencyCode}
          />
        </>
      )}
    </section>
  );
}
