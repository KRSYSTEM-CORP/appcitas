"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approveBusiness,
  denyBusiness,
  suspendBusiness,
  reactivateBusiness,
  setBusinessExempt,
  recordMaintenancePayment,
  type AdminBusinessRow,
} from "@/lib/actions/admin";
import { isBusinessBlocked } from "@/lib/billing";
import { DeleteBusinessButton } from "@/components/admin/DeleteBusinessButton";
import { formatDate } from "@/lib/format";

const STATUS_LABELS = { PENDING: "Pendiente", ACTIVE: "Activo", SUSPENDED: "Suspendido" } as const;
const STATUS_STYLES = {
  PENDING: "bg-warning/15 text-warning",
  ACTIVE: "bg-success/15 text-success",
  SUSPENDED: "bg-destructive/10 text-destructive",
} as const;

function addDaysISO(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function BillingBadge({ business }: { business: AdminBusinessRow }) {
  if (business.isExempt) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
        Exonerado
      </span>
    );
  }
  const blocked = isBusinessBlocked({
    isExempt: business.isExempt,
    nextPaymentDueDate: business.nextPaymentDueDate,
  });
  if (blocked) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive">
        Bloqueado por pago
      </span>
    );
  }
  if (business.nextPaymentDueDate) {
    return (
      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
        Vence el {formatDate(business.nextPaymentDueDate)}
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      Sin ciclo configurado
    </span>
  );
}

export function AdminBusinessTable({ businesses }: { businesses: AdminBusinessRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (businesses.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No hay negocios registrados todavía.</p>;
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Negocio</th>
            <th className="px-4 py-2 font-medium">Correo</th>
            <th className="px-4 py-2 font-medium">Registrado</th>
            <th className="px-4 py-2 font-medium">Estado</th>
            <th className="px-4 py-2 font-medium">Cobro</th>
            <th className="px-4 py-2 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <BusinessRow key={b.id} business={b} isPending={isPending} run={run} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BusinessRow({
  business: b,
  isPending,
  run,
}: {
  business: AdminBusinessRow;
  isPending: boolean;
  run: (action: () => Promise<unknown>) => void;
}) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(b.monthlyFeeUsdCents != null ? String(b.monthlyFeeUsdCents / 100) : "");
  const [payPeriodEnd, setPayPeriodEnd] = useState(() => addDaysISO(b.nextPaymentDueDate ?? new Date(), 30));
  const [payNote, setPayNote] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, startPaying] = useTransition();

  function handleRecordPayment() {
    setPayError(null);
    startPaying(async () => {
      const result = await recordMaintenancePayment(b.id, {
        amount: payAmount,
        periodEnd: payPeriodEnd,
        note: payNote,
      });
      if (!result.success) {
        setPayError(result.error);
        return;
      }
      setPayOpen(false);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-2 font-medium">{b.name}</td>
      <td className="px-4 py-2 text-muted-foreground">{b.ownerEmail}</td>
      <td className="px-4 py-2 text-muted-foreground">{formatDate(b.createdAt)}</td>
      <td className="px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[b.ownerStatus]}`}>
          {STATUS_LABELS[b.ownerStatus]}
        </span>
      </td>
      <td className="px-4 py-2">
        <BillingBadge business={b} />
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-col items-end gap-2">
          <div className="flex justify-end gap-2 flex-wrap">
            {b.ownerStatus === "PENDING" && (
              <>
                <Button size="sm" disabled={isPending} onClick={() => run(() => approveBusiness(b.ownerId))}>
                  Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => run(() => denyBusiness(b.ownerId))}
                >
                  Denegar
                </Button>
              </>
            )}
            {b.ownerStatus === "ACTIVE" && !b.isExempt && (
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => setPayOpen((v) => !v)}>
                Registrar pago
              </Button>
            )}
            {(b.ownerStatus === "ACTIVE" || b.ownerStatus === "PENDING") && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => setBusinessExempt(b.id, !b.isExempt))}
              >
                {b.isExempt ? "Quitar exoneración" : "Exonerar"}
              </Button>
            )}
            {b.ownerStatus === "ACTIVE" && (
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => run(() => suspendBusiness(b.ownerId))}
              >
                Suspender
              </Button>
            )}
            {b.ownerStatus === "SUSPENDED" && (
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => run(() => reactivateBusiness(b.ownerId))}
              >
                Reactivar
              </Button>
            )}
          </div>
          {payOpen && (
            <div className="flex flex-col gap-2 w-56 text-left">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`pay-amount-${b.id}`}>Monto (USD)</Label>
                <Input
                  id={`pay-amount-${b.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`pay-period-${b.id}`}>Nueva fecha de vencimiento</Label>
                <Input
                  id={`pay-period-${b.id}`}
                  type="date"
                  value={payPeriodEnd}
                  onChange={(e) => setPayPeriodEnd(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`pay-note-${b.id}`}>Nota (opcional)</Label>
                <Input
                  id={`pay-note-${b.id}`}
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Ej. Transferencia ref. 001234567"
                />
              </div>
              {payError && <p className="text-xs text-destructive">{payError}</p>}
              <Button size="sm" disabled={isPaying} onClick={handleRecordPayment}>
                Confirmar pago
              </Button>
            </div>
          )}
          <DeleteBusinessButton businessId={b.id} businessName={b.name} />
        </div>
      </td>
    </tr>
  );
}
