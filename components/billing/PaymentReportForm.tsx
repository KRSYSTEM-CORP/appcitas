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

type ReportLine = { paymentMethod: PaymentMethod; amount: string; reference: string };

export function PaymentReportForm({
  monthlyFeeUsdCents,
  monthlyFeeLocalAmount,
  localCurrencyCode,
}: {
  monthlyFeeUsdCents: number | null;
  monthlyFeeLocalAmount: number | null;
  localCurrencyCode: string;
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

  function addLine() {
    setLines((prev) => [...prev, { paymentMethod: "BINANCE", amount: "", reference: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitPaymentReport({
        lines: lines.map((l) => ({
          paymentMethod: l.paymentMethod,
          amount: l.amount,
          reference: l.reference,
        })),
        note,
      });
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
      {lines.map((line, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="flex gap-2 flex-wrap">
            {BILLING_PAYMENT_METHODS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={line.paymentMethod === m ? "default" : "outline"}
                onClick={() => updateLine(i, { paymentMethod: m })}
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
              <Label htmlFor={`report-amount-${i}`}>Monto (USD)</Label>
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
              Monto de la suscripción: {formatLocalCurrency(monthlyFeeLocalAmount, localCurrencyCode)} (a tu tasa
              actual) — ingresa su equivalente en USD arriba.
            </p>
          )}
        </div>
      ))}

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
