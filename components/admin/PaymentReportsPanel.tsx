"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
import {
  approvePaymentReport,
  rejectPaymentReport,
  updatePlatformSettings,
  fetchAndUpdatePlatformBcvRate,
} from "@/lib/actions/admin";

type PendingReportLine = {
  paymentMethod: PaymentMethod;
  amountUsdCents: number;
  reference: string | null;
};

type PendingReport = {
  id: string;
  businessId: string;
  proofImageDataUrl: string | null;
  note: string | null;
  createdAt: Date;
  business: { name: string };
  lines: PendingReportLine[];
};

export function PlatformSettingsForm({
  initialInstructions,
  initialBillingExchangeRate,
  initialDefaultMonthlyFeeUsdCents,
}: {
  initialInstructions: string | null;
  initialBillingExchangeRate: number | null;
  initialDefaultMonthlyFeeUsdCents: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [instructions, setInstructions] = useState(initialInstructions ?? "");
  const [rate, setRate] = useState(initialBillingExchangeRate != null ? String(initialBillingExchangeRate) : "");
  const [defaultFee, setDefaultFee] = useState(
    initialDefaultMonthlyFeeUsdCents != null ? String(initialDefaultMonthlyFeeUsdCents / 100) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isFetchingBcv, startBcvFetch] = useTransition();
  const [bcvError, setBcvError] = useState<string | null>(null);

  function handleFetchBcv() {
    setBcvError(null);
    setSaved(false);
    startBcvFetch(async () => {
      const result = await fetchAndUpdatePlatformBcvRate();
      if (!result.success) {
        setBcvError(result.error);
        return;
      }
      setRate(String(result.rate));
      router.refresh();
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePlatformSettings({
        paymentInstructions: instructions,
        billingExchangeRate: rate,
        defaultMonthlyFee: defaultFee,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3 max-w-lg">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="platform-default-fee">Precio mensual estándar (USD)</Label>
        <Input
          id="platform-default-fee"
          type="number"
          step="0.01"
          min="0"
          value={defaultFee}
          onChange={(e) => {
            setDefaultFee(e.target.value);
            setSaved(false);
          }}
          placeholder="Ej. 25.00"
        />
        <p className="text-xs text-muted-foreground">
          Se aplica automáticamente a todo negocio nuevo al aprobarlo, salvo que le pongas un
          precio distinto después.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="platform-rate">Tasa de cambio de la plataforma (Bs/USD)</Label>
        <div className="flex gap-2">
          <Input
            id="platform-rate"
            type="number"
            step="0.0001"
            min="0"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setSaved(false);
            }}
            placeholder="Ej. 45.0000"
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={handleFetchBcv}
            disabled={isFetchingBcv}
          >
            {isFetchingBcv ? "Consultando BCV..." : "Actualizar con tasa BCV"}
          </Button>
        </div>
        {bcvError && <p className="text-sm text-destructive">{bcvError}</p>}
        <p className="text-xs text-muted-foreground">
          Se actualiza sola todos los días con la tasa oficial del BCV. Al cambiarla (manual o con
          el botón), el monto en bolívares que ve cada negocio se recalcula automáticamente.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="platform-instructions">Instrucciones de pago</Label>
        <Textarea
          id="platform-instructions"
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder="Ej. Transferencia: Banco XXX, Teléfono 0412-1234567, RIF J-12345678-9, Titular: KR System C.A."
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-muted-foreground">Guardado.</p>}
      <Button type="submit" size="sm" disabled={isPending} className="self-start">
        Guardar
      </Button>
    </form>
  );
}

export function PendingReportsTable({ reports }: { reports: PendingReport[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleApprove(reportId: string) {
    startTransition(async () => {
      await approvePaymentReport(reportId);
      router.refresh();
    });
  }

  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No hay reportes de pago pendientes.</p>;
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Negocio</th>
            <th className="px-4 py-2 font-medium">Métodos de pago</th>
            <th className="px-4 py-2 font-medium">Total</th>
            <th className="px-4 py-2 font-medium">Nota</th>
            <th className="px-4 py-2 font-medium">Comprobante</th>
            <th className="px-4 py-2 font-medium">Fecha</th>
            <th className="px-4 py-2 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <PendingReportRow key={r.id} report={r} isPending={isPending} onApprove={handleApprove} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PendingReportRow({
  report: r,
  isPending,
  onApprove,
}: {
  report: PendingReport;
  isPending: boolean;
  onApprove: (reportId: string) => void;
}) {
  const [isRejecting, startTransition] = useTransition();
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totalUsdCents = r.lines.reduce((sum, l) => sum + l.amountUsdCents, 0);

  function handleReject(e: React.MouseEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await rejectPaymentReport(r.id, { reviewNote });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRejectOpen(false);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-2 font-medium">{r.business.name}</td>
      <td className="px-4 py-2">
        {r.lines.map((line, i) => (
          <div key={i}>
            {PAYMENT_METHOD_LABELS[line.paymentMethod]}: {formatMoney(line.amountUsdCents, "USD")}
            {line.reference && ` (${line.reference})`}
          </div>
        ))}
      </td>
      <td className="px-4 py-2 font-medium">{formatMoney(totalUsdCents, "USD")}</td>
      <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{r.note ?? "—"}</td>
      <td className="px-4 py-2">
        {r.proofImageDataUrl ? (
          <a href={r.proofImageDataUrl} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
            Ver
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-muted-foreground">{formatDate(r.createdAt)}</td>
      <td className="px-4 py-2">
        <div className="flex flex-col items-end gap-2">
          <div className="flex justify-end gap-2">
            <Button size="sm" disabled={isPending} onClick={() => onApprove(r.id)}>
              Aprobar
            </Button>
            <Button size="sm" variant="outline" disabled={isRejecting} onClick={() => setRejectOpen((v) => !v)}>
              Rechazar
            </Button>
          </div>
          {rejectOpen && (
            <div className="flex flex-col gap-2 w-48">
              <Input
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Motivo (opcional)"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button size="sm" variant="destructive" disabled={isRejecting} onClick={handleReject}>
                Confirmar rechazo
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
