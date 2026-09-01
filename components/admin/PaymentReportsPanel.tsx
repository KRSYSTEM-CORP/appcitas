"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { resizeImageToDataUrl } from "@/lib/image-utils";
import { approvePaymentReport, rejectPaymentReport, updatePlatformSettings } from "@/lib/actions/admin";

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
  initialBinanceQrDataUrl,
  initialBinanceId,
  initialPagoMovilBank,
  initialPagoMovilPhone,
  initialPagoMovilId,
  initialDefaultMonthlyFeeUsdCents,
}: {
  initialInstructions: string | null;
  initialBinanceQrDataUrl: string | null;
  initialBinanceId: string | null;
  initialPagoMovilBank: string | null;
  initialPagoMovilPhone: string | null;
  initialPagoMovilId: string | null;
  initialDefaultMonthlyFeeUsdCents: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [instructions, setInstructions] = useState(initialInstructions ?? "");
  const [binanceQrDataUrl, setBinanceQrDataUrl] = useState(initialBinanceQrDataUrl ?? "");
  const [binanceId, setBinanceId] = useState(initialBinanceId ?? "");
  const [pagoMovilBank, setPagoMovilBank] = useState(initialPagoMovilBank ?? "");
  const [pagoMovilPhone, setPagoMovilPhone] = useState(initialPagoMovilPhone ?? "");
  const [pagoMovilId, setPagoMovilId] = useState(initialPagoMovilId ?? "");
  const [defaultFee, setDefaultFee] = useState(
    initialDefaultMonthlyFeeUsdCents != null ? String(initialDefaultMonthlyFeeUsdCents / 100) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  async function handleQrFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, { maxDimension: 600, format: "image/png" });
      setBinanceQrDataUrl(dataUrl);
      setSaved(false);
    } catch {
      setError("No se pudo procesar la imagen. Intenta con otro archivo.");
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updatePlatformSettings({
        paymentInstructions: instructions,
        binanceQrDataUrl,
        binanceId,
        pagoMovilBank,
        pagoMovilPhone,
        pagoMovilId,
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
        />
        <p className="text-xs text-muted-foreground">Ej. 25.00</p>
        <p className="text-xs text-muted-foreground">
          Se aplica automáticamente a todo negocio nuevo al aprobarlo, salvo que le pongas un
          precio distinto después.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>QR de Binance Pay</Label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {binanceQrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={binanceQrDataUrl}
              alt="QR de Binance Pay"
              className="h-20 w-20 shrink-0 rounded object-cover border"
            />
          ) : (
            <div className="h-20 w-20 shrink-0 rounded border flex items-center justify-center text-xs text-muted-foreground text-center">
              Sin QR
            </div>
          )}
          <input
            ref={qrInputRef}
            type="file"
            accept="image/*"
            onChange={handleQrFileChange}
            className="text-sm min-w-0 max-w-full"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="platform-binance-id">ID de la cuenta de Binance</Label>
        <Input
          id="platform-binance-id"
          value={binanceId}
          onChange={(e) => {
            setBinanceId(e.target.value);
            setSaved(false);
          }}
        />
        <p className="text-xs text-muted-foreground">Ej. 123456789</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border p-3">
        <div className="sm:col-span-3">
          <Label className="text-sm font-medium">Pago Móvil</Label>
          <p className="text-xs text-muted-foreground">
            Segundo método para pagar la suscripción, en bolívares.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platform-pm-bank">Banco</Label>
          <Input
            id="platform-pm-bank"
            value={pagoMovilBank}
            onChange={(e) => {
              setPagoMovilBank(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">Ej. Banesco</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platform-pm-phone">Teléfono</Label>
          <Input
            id="platform-pm-phone"
            value={pagoMovilPhone}
            onChange={(e) => {
              setPagoMovilPhone(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">Ej. 0412-1234567</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="platform-pm-id">Cédula/RIF</Label>
          <Input
            id="platform-pm-id"
            value={pagoMovilId}
            onChange={(e) => {
              setPagoMovilId(e.target.value);
              setSaved(false);
            }}
          />
          <p className="text-xs text-muted-foreground">Ej. V-12345678</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="platform-instructions">Notas adicionales (opcional)</Label>
        <Textarea
          id="platform-instructions"
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setSaved(false);
          }}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Ej. Solo en horario laboral, confirma por WhatsApp antes de enviar
        </p>
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
              <Label htmlFor={`review-note-${r.id}`}>Motivo (opcional)</Label>
              <Input
                id={`review-note-${r.id}`}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
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
