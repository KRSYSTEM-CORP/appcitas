import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DeletePackageButton } from "@/components/packages/DeletePackageButton";
import { listPackages } from "@/lib/actions/packages";
import { getFxInfo } from "@/lib/actions/business";
import { formatDate, formatMoney } from "@/lib/format";
import { serviceLocalPriceCents } from "@/lib/pricing";

const PAYMENT_MODE_LABELS = {
  PACKAGE: "Pago único",
  PER_SESSION: "Pago por sesión",
} as const;

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric" });

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const monthKey = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthKey();
  const [packages, fx] = await Promise.all([listPackages(monthKey), getFxInfo()]);
  const monthLabel = MONTH_LABEL_FORMATTER.format(new Date(`${monthKey}-01T00:00:00`));

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

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/packages?month=${addMonths(monthKey, -1)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            ← Anterior
          </Link>
          <Link href={`/packages?month=${currentMonthKey()}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Este mes
          </Link>
          <Link href={`/packages?month=${addMonths(monthKey, 1)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Siguiente →
          </Link>
        </div>
        <p className="text-sm font-medium capitalize">{monthLabel}</p>
      </div>

      {packages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
          Ningún paquete creado en {monthLabel}.
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
