import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DeletePackageButton } from "@/components/packages/DeletePackageButton";
import { listPackages } from "@/lib/actions/packages";
import { getFxInfo } from "@/lib/actions/business";
import { formatDate, formatDayLabel, formatMoney, toDateKey } from "@/lib/format";
import { serviceLocalPriceCents } from "@/lib/pricing";
import { RANGE_VIEWS, getRange, shiftDate, type RangeView } from "@/lib/date-range";

const PAYMENT_MODE_LABELS = {
  PACKAGE: "Pago único",
  PER_SESSION: "Pago por sesión",
} as const;

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric" });

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { date, view: viewParam } = await searchParams;
  const dateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date());
  const view: RangeView = RANGE_VIEWS.some((v) => v.key === viewParam) ? (viewParam as RangeView) : "month";

  const { start, end } = getRange(view, dateKey);
  const [packages, fx] = await Promise.all([listPackages({ start, end }), getFxInfo()]);

  const rangeLabel =
    view === "day"
      ? formatDayLabel(new Date(`${dateKey}T00:00:00`))
      : view === "week"
        ? `${formatDate(start)} – ${formatDate(new Date(end.getTime() - 24 * 60 * 60_000))}`
        : MONTH_LABEL_FORMATTER.format(start);

  return (
    <div className="flex flex-col gap-4 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Paquetes de sesiones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Clientes con varias citas agendadas de una vez (fisioterapia, tratamientos, etc.)
          </p>
        </div>
        <Link href="/packages/new" className={buttonVariants({})}>
          Nuevo paquete
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {RANGE_VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/packages?view=${v.key}&date=${v.key === "day" ? toDateKey(new Date()) : dateKey}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                view === v.key ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/packages?view=${view}&date=${shiftDate(view, dateKey, -1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Anterior
          </Link>
          <Link
            href={`/packages?view=${view}&date=${toDateKey(new Date())}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Hoy
          </Link>
          <Link
            href={`/packages?view=${view}&date=${shiftDate(view, dateKey, 1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Siguiente →
          </Link>
        </div>
      </div>
      <p className="text-sm font-medium capitalize">{rangeLabel}</p>

      {packages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
          Ningún paquete creado en este período.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.map((p) => {
            const paidLocalCents = p.transactions.reduce((sum, t) => sum + t.amountLocalCents, 0);
            const packagePriceLocalCents =
              p.packagePriceCents != null
                ? serviceLocalPriceCents(
                    { basePriceCents: p.packagePriceCents, priceCurrencyCode: p.packagePriceCurrencyCode! },
                    { localCurrencyCode: fx.localCurrencyCode },
                    fx.rate,
                  )
                : null;
            const packageFullyPaid =
              p.paymentMode === "PACKAGE" && packagePriceLocalCents != null && paidLocalCents >= packagePriceLocalCents;
            const clientName = `${p.client.firstName} ${p.client.lastName}`;
            return (
              <div
                key={p.id}
                className="rounded-md border border-border px-4 py-3 flex items-center justify-between gap-3 hover:bg-accent transition-colors"
              >
                <Link href={`/packages/${p.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {clientName} · {p.service.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.specialist.displayName} · {p.sessionsAttended}/{p.totalSessions} sesiones asistidas
                    {p.sessionsCancelled > 0 && ` · ${p.sessionsCancelled} canceladas`} · Creado el{" "}
                    {formatDate(p.createdAt)}
                  </p>
                </Link>
                <div className="flex items-center gap-4 shrink-0">
                  <Link href={`/packages/${p.id}`} className="text-right">
                    <p className="text-xs font-medium">{PAYMENT_MODE_LABELS[p.paymentMode]}</p>
                    {p.paymentMode === "PACKAGE" && p.packagePriceCents != null ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {packageFullyPaid
                          ? "Pagado completo"
                          : formatMoney(p.packagePriceCents, p.packagePriceCurrencyCode!)}
                      </p>
                    ) : (
                      paidLocalCents > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cobrado hasta ahora: {formatMoney(paidLocalCents, fx.localCurrencyCode)}
                        </p>
                      )
                    )}
                  </Link>
                  <DeletePackageButton packageId={p.id} clientName={clientName} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
