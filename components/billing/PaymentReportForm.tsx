"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPaymentReport } from "@/lib/actions/billing";
import { PAYMENT_METHOD_LABELS, formatUSDT } from "@/lib/format";
import { formatLocalCurrency } from "@/lib/currencies";
import { PAYMENT_METHODS_REQUIRING_REFERENCE } from "@/lib/validations";
import type { PaymentMethod } from "@prisma/client";

// The subscription accepts exactly these two rails — no more cash, card,
// Transferencia, etc. for paying KR System itself (this restriction is
// specific to this billing report, not the general PAYMENT_METHOD_LABELS
// used elsewhere for a business' own service payments).
const BILLING_PAYMENT_METHODS: PaymentMethod[] = ["BINANCE", "PAGO_MOVIL"];

// What currency each line's amount field is actually typed in — amountUsdCents
// is always USD-denominated in the database (see submitPaymentReport), but a
// business paying by Pago Móvil sees their total in Bolívares, so the field
// itself shows Bs for that line and gets converted to USD at submit time
// (see toUsdAmount below) instead of asking the business to do that math.
function fieldCurrency(method: PaymentMethod): "USD" | "VES" {
  return method === "PAGO_MOVIL" ? "VES" : "USD";
}

type ReportLine = { paymentMethod: PaymentMethod; amount: string; reference: string };

export function PaymentReportForm({
  monthlyFeeUsdCents,
  monthlyFeeLocalAmount,
  platformRate,
}: {
  monthlyFeeUsdCents: number | null;
  monthlyFeeLocalAmount: number | null;
  platformRate: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [lines, setLines] = useState<ReportLine[]>([{ paymentMethod: "BINANCE", amount: "", reference: "" }]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function updateLine(i: number, patch: Partial<ReportLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setSubmitted(false);
  }

  // Switching methods changes what currency the same typed number would
  // mean, so the amount is cleared rather than silently reinterpreted.
  function setPaymentMethod(i: number, method: PaymentMethod) {
    updateLine(i, { paymentMethod: method, amount: "" });
  }

  function addLine() {
    setLines((prev) => [...prev, { paymentMethod: "BINANCE", amount: "", reference: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  // The typed amount for a PAGO_MOVIL line is in Bolívares — resolve it to
  // the USD figure the schema/database actually store, using KR System's
  // own BCV rate (same one shown as "tasa BCV" below).
  function toUsdAmount(line: ReportLine): string | null {
    if (fieldCurrency(line.paymentMethod) === "USD") return line.amount;
    const bs = Number(line.amount);
    if (!Number.isFinite(bs) || platformRate == null || platformRate <= 0) return null;
    return (bs / platformRate).toFixed(2);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const resolvedLines: { paymentMethod: PaymentMethod; amount: string; reference: string }[] = [];
    for (const line of lines) {
      const amount = toUsdAmount(line);
      if (amount == null) {
        setError("No se pudo calcular el monto en USD para un pago en Pago Móvil. Intenta de nuevo.");
        return;
      }
      resolvedLines.push({ paymentMethod: line.paymentMethod, amount, reference: line.reference });
    }

    startTransition(async () => {
      const result = await submitPaymentReport({ lines: resolvedLines, note });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLines([{ paymentMethod: "BINANCE", amount: "", reference: "" }]);
      setNote("");
      setSubmitted(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      {lines.map((line, i) => {
        const currency = fieldCurrency(line.paymentMethod);
        return (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex gap-2 flex-wrap">
              {BILLING_PAYMENT_METHODS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={line.paymentMethod === m ? "default" : "outline"}
                  onClick={() => setPaymentMethod(i, m)}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </Button>
              ))}
              {lines.length > 1 && (
                <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => removeLine(i)}>
                  ✕
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`report-amount-${i}`}>Monto ({currency === "VES" ? "Bs" : "USD"})</Label>
                <Input
                  id={`report-amount-${i}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.amount}
                  onChange={(e) => updateLine(i, { amount: e.target.value })}
                />
              </div>
              {(PAYMENT_METHODS_REQUIRING_REFERENCE as readonly string[]).includes(line.paymentMethod) && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`report-reference-${i}`}>Nº de referencia</Label>
                  <Input
                    id={`report-reference-${i}`}
                    value={line.reference}
                    onChange={(e) => updateLine(i, { reference: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Ej. 001234567</p>
                </div>
              )}
            </div>
            {line.paymentMethod === "BINANCE" && monthlyFeeUsdCents != null && (
              <p className="text-xs text-muted-foreground">
                Monto de la suscripción: {formatUSDT(monthlyFeeUsdCents)}
              </p>
            )}
            {line.paymentMethod === "PAGO_MOVIL" && monthlyFeeLocalAmount != null && (
              <p className="text-xs text-muted-foreground">
                Monto de la suscripción: {formatLocalCurrency(monthlyFeeLocalAmount, "VES")} (tasa BCV).
              </p>
            )}
          </div>
        );
      })}

      <Button type="button" size="sm" variant="outline" onClick={addLine}>
        + Agregar otro pago
      </Button>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-note">Nota (opcional)</Label>
        <Input
          id="report-note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSubmitted(false);
          }}
        />
        <p className="text-xs text-muted-foreground">Ej. Pagué el 15 de julio por Binance</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {submitted && !error && (
        <p className="text-sm text-muted-foreground">
          Reporte enviado. No olvides enviar también el comprobante por WhatsApp — el super admin lo
          revisará y tu cuenta se desbloqueará al ser aprobado.
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        Reportar pago
      </Button>
    </form>
  );
}
