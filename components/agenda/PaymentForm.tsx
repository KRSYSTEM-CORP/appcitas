"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPayments } from "@/lib/actions/payments";
import { PAYMENT_METHOD_LABELS, formatMoney } from "@/lib/format";
import { PAYMENT_METHODS_REQUIRING_REFERENCE, USD_ALWAYS_METHODS } from "@/lib/validations";
import type { PaymentMethod } from "@prisma/client";

const METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "CARD", "PAGO_MOVIL", "BINANCE", "OTHER"];

type Line = {
  id: string;
  amount: string;
  currency: "LOCAL" | "FOREIGN";
  method: PaymentMethod;
  reference: string;
};

function newLine(amount = ""): Line {
  return { id: crypto.randomUUID(), amount, currency: "LOCAL", method: "CASH", reference: "" };
}

export function PaymentForm({
  target,
  defaultAmount,
  fxEnabled,
  localCurrencyCode,
  foreignCurrencyCode,
  rate,
  onDone,
}: {
  target: { appointmentId: string } | { packageId: string };
  defaultAmount: number;
  fxEnabled: boolean;
  localCurrencyCode: string;
  foreignCurrencyCode: string;
  rate: number | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([newLine(defaultAmount.toFixed(2))]);
  const [discount, setDiscount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  // Discount only ever recalculates the FIRST line (the one pre-filled with
  // the service's full price) — extra split-payment lines someone adds
  // afterward are their own separate charges and shouldn't get discounted
  // along with it.
  function applyDiscount(rawDiscount: string) {
    setDiscount(rawDiscount);
    const discountAmount = Number(rawDiscount);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) return;
    setLines((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      if (first.currency !== "LOCAL") return prev; // discount is entered in local currency only
      const discounted = Math.max(0, defaultAmount - discountAmount);
      return [{ ...first, amount: discounted.toFixed(2) }, ...rest];
    });
  }

  function exempt() {
    setDiscount(defaultAmount.toFixed(2));
    setLines((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      return [{ ...first, amount: "0", currency: "LOCAL", method: "OTHER", reference: "Exonerado" }, ...rest];
    });
  }

  function switchLineCurrency(line: Line, next: "LOCAL" | "FOREIGN", extraPatch?: Partial<Line>) {
    if (next === line.currency || rate == null) {
      updateLine(line.id, { currency: next, ...extraPatch });
      return;
    }
    // Convert the typed amount along so switching currency doesn't silently
    // change what's about to be submitted (local cents / rate = foreign,
    // foreign * rate = local — see lib/actions/payments.ts for the same math).
    const n = Number(line.amount);
    if (Number.isFinite(n) && n > 0) {
      const converted = next === "FOREIGN" ? n / rate : n * rate;
      updateLine(line.id, { currency: next, amount: converted.toFixed(2), ...extraPatch });
    } else {
      updateLine(line.id, { currency: next, ...extraPatch });
    }
  }

  function selectLineMethod(line: Line, method: PaymentMethod) {
    if ((USD_ALWAYS_METHODS as readonly string[]).includes(method)) {
      switchLineCurrency(line, "FOREIGN", { method });
    } else {
      updateLine(line.id, { method });
    }
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const line of lines) {
      // 0 is allowed — that's what a fully exonerated line looks like (see
      // the "Exonerar" button above) — only negative/invalid amounts fail.
      if (!(Number(line.amount) >= 0)) {
        setError("Cada línea de pago necesita un monto válido");
        return;
      }
      const needsReference = (PAYMENT_METHODS_REQUIRING_REFERENCE as readonly string[]).includes(line.method);
      if (needsReference && !line.reference.trim()) {
        setError(`Indica la referencia para ${PAYMENT_METHOD_LABELS[line.method]}`);
        return;
      }
    }

    startTransition(async () => {
      const payload = lines.map((l) => ({
        amount: Number(l.amount),
        currency: (USD_ALWAYS_METHODS as readonly string[]).includes(l.method) ? ("FOREIGN" as const) : l.currency,
        paymentMethod: l.method,
        reference: l.reference || undefined,
      }));
      const result = await recordPayments(target, payload);
      if (result.success) {
        router.refresh();
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-border bg-card p-2.5">
      <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <Label htmlFor="payment-discount" className="text-xs">
              Descuento ({localCurrencyCode}, opcional)
            </Label>
            <Input
              id="payment-discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => applyDiscount(e.target.value)}
              placeholder="0.00"
              className="h-8 text-sm"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={exempt} className="h-8">
            Exonerar (gratis)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Precio original: {formatMoney(Math.round(defaultAmount * 100), localCurrencyCode)}
        </p>
      </div>

      {lines.map((line, i) => {
        const needsReference = (PAYMENT_METHODS_REQUIRING_REFERENCE as readonly string[]).includes(line.method);
        const isUsdAlwaysMethod = (USD_ALWAYS_METHODS as readonly string[]).includes(line.method);
        const effectiveCurrency: "LOCAL" | "FOREIGN" = isUsdAlwaysMethod ? "FOREIGN" : line.currency;
        const canToggleCurrency = fxEnabled && rate != null && !isUsdAlwaysMethod;
        const currencyLabel = effectiveCurrency === "FOREIGN" ? foreignCurrencyCode : localCurrencyCode;

        return (
          <div key={line.id} className={`flex flex-col gap-2 ${i > 0 ? "border-t border-border pt-2" : ""}`}>
            {lines.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Pago {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  className="text-xs text-destructive underline underline-offset-2 hover:opacity-80"
                >
                  Quitar
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => selectLineMethod(line, m)}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    line.method === m ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
                  }`}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <Label htmlFor={`payment-amount-${line.id}`} className="text-xs">
                  Monto ({currencyLabel})
                </Label>
                <Input
                  id={`payment-amount-${line.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.amount}
                  onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                  className="h-8 text-sm"
                  required
                />
              </div>
              {canToggleCurrency && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Moneda</Label>
                  <div className="flex h-8 rounded-md border border-input overflow-hidden">
                    <button
                      type="button"
                      onClick={() => switchLineCurrency(line, "LOCAL")}
                      className={`px-2 text-xs font-medium ${
                        effectiveCurrency === "LOCAL" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      {localCurrencyCode}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchLineCurrency(line, "FOREIGN")}
                      className={`px-2 text-xs font-medium ${
                        effectiveCurrency === "FOREIGN" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      {foreignCurrencyCode}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {isUsdAlwaysMethod && (
              <p className="text-xs text-muted-foreground">Este método siempre se cobra en {foreignCurrencyCode}.</p>
            )}

            {needsReference && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`payment-reference-${line.id}`} className="text-xs">
                  {line.method === "BINANCE" ? "ID de transacción" : "Nº de referencia"}
                </Label>
                <Input
                  id={`payment-reference-${line.id}`}
                  value={line.reference}
                  onChange={(e) => updateLine(line.id, { reference: e.target.value })}
                  placeholder={line.method === "BINANCE" ? "Ej. 12345678" : "Ej. 001234567"}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground text-left"
      >
        + Agregar otro método de pago
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending} className="flex-1">
          {isPending ? "Guardando..." : lines.length > 1 ? "Guardar pagos" : "Guardar pago"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
