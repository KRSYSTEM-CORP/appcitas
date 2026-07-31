import { PaymentReportForm } from "@/components/billing/PaymentReportForm";
import { PagoMovilCheckout } from "@/components/billing/PagoMovilCheckout";
import { getBillingInfo, listMyPaymentReports } from "@/lib/actions/billing";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
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

  // The Bs equivalent is only shown here as a heads-up for VES businesses
  // (who typically pay via Pago Móvil) while reporting a payment — the
  // headline "cost" is always the USD amount; the actual Bs amount used
  // when a report is approved is computed from whatever the platform rate
  // is at that moment, not frozen here.
  const previewBs =
    info.localCurrencyCode === "VES" && info.monthlyFeeUsdCents != null && info.billingExchangeRate != null
      ? (info.monthlyFeeUsdCents / 100) * info.billingExchangeRate
      : null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Costo mensual</h2>
            {info.monthlyFeeUsdCents != null ? (
              <>
                <span className="text-2xl font-semibold">{formatMoney(info.monthlyFeeUsdCents, "USD")}</span>
                {previewBs != null && (
                  <span className="text-xs text-muted-foreground">
                    ≈ {formatMoney(previewBs * 100, info.localCurrencyCode)} a la tasa vigente
                  </span>
                )}
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

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Cómo pagar</h2>
            {info.paymentInstructions ? (
              <p className="text-sm whitespace-pre-line">{info.paymentInstructions}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                El super admin todavía no ha configurado el método de pago.
              </p>
            )}
          </div>
        </div>
      )}

      {!info.isExempt && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Pago Móvil automático</h2>
            <p className="text-sm text-muted-foreground">
              Transfiere el monto exacto que te indiquemos y tu suscripción se renueva sola — no
              necesitas esperar a que nadie apruebe nada.
            </p>
            <PagoMovilCheckout paymentInstructions={info.paymentInstructions} />
          </div>

          <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Reportar pago manual</h2>
            {previewBs != null && (
              <p className="text-sm text-muted-foreground">
                Monto aproximado en bolívares a la tasa vigente:{" "}
                <span className="font-medium">{formatMoney(previewBs * 100, info.localCurrencyCode)}</span>
              </p>
            )}
            <PaymentReportForm />
          </div>
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
