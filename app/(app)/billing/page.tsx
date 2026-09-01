import { PaymentReportForm } from "@/components/billing/PaymentReportForm";
import { getBillingInfo, listMyPaymentReports } from "@/lib/actions/billing";
import { formatDate, formatMoney, formatUSDT, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { formatLocalCurrency } from "@/lib/currencies";
import { WHATSAPP_PHONE } from "@/lib/legal";
import type { PaymentReportStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<PaymentReportStatus, string> = {
  PENDING: "Pendiente de revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

const STATUS_STYLES: Record<PaymentReportStatus, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/10 text-destructive",
};

export default async function BillingPage() {
  const [info, reports] = await Promise.all([getBillingInfo(), listMyPaymentReports()]);

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">Suscripción mensual</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Costo mensual de la plataforma, cómo pagarlo y el estado de tus reportes de pago.
        </p>
      </div>

      {info.isExempt ? (
        <div className="max-w-md rounded-md border border-border bg-card p-4 flex flex-col gap-2">
          <span className="w-fit rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            Exonerada
          </span>
          <p className="text-sm text-muted-foreground">
            Tu negocio está exonerado de todo cobro de mantenimiento por el super admin. No
            necesitas reportar pagos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Costo mensual</h2>
            {info.monthlyFeeUsdCents != null ? (
              <>
                <span className="text-2xl font-semibold">{formatMoney(info.monthlyFeeUsdCents, "USD")}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                Todavía no tienes un ciclo de cobro configurado.
              </span>
            )}
            {info.nextPaymentDueDate && (
              <span className="text-sm text-muted-foreground">
                Vence el {formatDate(info.nextPaymentDueDate)}
              </span>
            )}
            {info.blocked && (
              <span className="w-fit rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
                Cuenta bloqueada por pago
              </span>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Cómo pagar — Binance (USDT)</h2>
            {info.monthlyFeeUsdCents != null && (
              <p className="text-sm">
                <span className="text-muted-foreground">Monto a pagar: </span>
                <span className="font-medium">{formatUSDT(info.monthlyFeeUsdCents)}</span>
              </p>
            )}
            {info.binanceQrDataUrl || info.binanceId ? (
              <>
                {info.binanceQrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={info.binanceQrDataUrl}
                    alt="QR de Binance Pay"
                    className="h-40 w-40 rounded-lg border object-cover"
                  />
                )}
                {info.binanceId && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">ID de Binance: </span>
                    <span className="font-medium">{info.binanceId}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                El super admin todavía no ha configurado los datos de Binance.
              </p>
            )}
            {info.paymentInstructions && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{info.paymentInstructions}</p>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Pago Móvil</h2>
            {info.monthlyFeeLocalAmount != null && (
              <p className="text-sm">
                <span className="text-muted-foreground">Monto a pagar: </span>
                <span className="font-medium">
                  {formatLocalCurrency(info.monthlyFeeLocalAmount, info.localCurrencyCode)}
                </span>
              </p>
            )}
            {info.pagoMovilBank || info.pagoMovilPhone || info.pagoMovilId ? (
              <>
                {info.pagoMovilBank && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Banco: </span>
                    <span className="font-medium">{info.pagoMovilBank}</span>
                  </p>
                )}
                {info.pagoMovilPhone && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Teléfono: </span>
                    <span className="font-medium">{info.pagoMovilPhone}</span>
                  </p>
                )}
                {info.pagoMovilId && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Cédula/RIF: </span>
                    <span className="font-medium">{info.pagoMovilId}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {info.monthlyFeeLocalAmount != null
                    ? "Este monto cambia a diario según tu tasa de cambio configurada."
                    : "Paga el equivalente en bolívares a la tasa del día."}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                El super admin todavía no ha configurado los datos de Pago Móvil.
              </p>
            )}
          </div>
        </div>
      )}

      {!info.isExempt && (
        <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Reportar pago</h2>
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex flex-col gap-2">
            <p className="text-sm font-medium">Pasos obligatorios para activar tu suscripción:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside flex flex-col gap-1">
              <li>Paga por Binance (USDT) o Pago Móvil, con los datos de arriba.</li>
              <li>Completa el formulario de abajo con los datos del pago.</li>
              <li>Envía tu comprobante de pago por WhatsApp (obligatorio) — así te confirmamos más rápido.</li>
            </ol>
            <a
              href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
                `Hola, les envío el comprobante de pago de la suscripción de ${info.businessName}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline underline-offset-4 w-fit"
            >
              Enviar comprobante por WhatsApp →
            </a>
          </div>
          <PaymentReportForm
            monthlyFeeUsdCents={info.monthlyFeeUsdCents}
            monthlyFeeLocalAmount={info.monthlyFeeLocalAmount}
            localCurrencyCode={info.localCurrencyCode}
          />
        </div>
      )}

      <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Historial de reportes</h2>
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Métodos de pago</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Nota del admin</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const totalUsdCents = r.lines.reduce((sum, l) => sum + l.amountUsdCents, 0);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-2">
                      {r.lines.map((line, i) => (
                        <div key={i}>
                          {PAYMENT_METHOD_LABELS[line.paymentMethod]}: {formatMoney(line.amountUsdCents, "USD")}
                          {line.reference && ` (${line.reference})`}
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2 font-medium">{formatMoney(totalUsdCents, "USD")}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.reviewNote ?? "—"}</td>
                  </tr>
                );
              })}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted-foreground py-8">
                    Todavía no has reportado ningún pago.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
