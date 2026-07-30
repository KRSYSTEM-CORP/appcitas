"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { PaymentForm } from "@/components/agenda/PaymentForm";
import { CopyCancelLinkButton } from "@/components/shared/CopyCancelLinkButton";
import { PaymentReceiptDialog } from "@/components/shared/PaymentReceiptDialog";
import { serviceLocalPriceCents } from "@/lib/pricing";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  PAYMENT_METHOD_LABELS,
  formatDate,
  formatMoney,
  formatTime,
  toDateKey,
} from "@/lib/format";
import type { PackageDetail } from "@/lib/actions/packages";
import type { AppointmentStatus } from "@prisma/client";

const STATUS_OPTIONS: AppointmentStatus[] = ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"];

const PAYMENT_MODE_LABELS = {
  PACKAGE: "Un solo pago por todo el paquete",
  PER_SESSION: "Pago por sesión asistida",
} as const;

export function PackageDetailView({
  pkg,
  currencyCode,
  fxEnabled,
  foreignCurrencyCode,
  rate,
  businessName,
}: {
  pkg: PackageDetail;
  currencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  rate: number | null;
  businessName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  function handleStatusChange(appointmentId: string, status: AppointmentStatus) {
    startTransition(async () => {
      await updateAppointmentStatus(appointmentId, status);
      router.refresh();
    });
  }

  const isPackagePayment = pkg.paymentMode === "PACKAGE";

  const packagePriceLocalCents =
    pkg.packagePriceCents != null
      ? serviceLocalPriceCents(
          { basePriceCents: pkg.packagePriceCents, priceCurrencyCode: pkg.packagePriceCurrencyCode! },
          { localCurrencyCode: currencyCode },
          rate,
        )
      : null;
  const paidLocalCents = pkg.transactions.reduce((sum, t) => sum + t.amountLocalCents, 0);
  const remainingLocalCents =
    packagePriceLocalCents != null ? Math.max(0, packagePriceLocalCents - paidLocalCents) : null;
  const fullyPaid = packagePriceLocalCents != null && remainingLocalCents === 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <Link href="/packages" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          ← Todos los paquetes
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          {pkg.client.firstName} {pkg.client.lastName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pkg.service.name} con {pkg.specialist.displayName} · {pkg.client.phone}
        </p>
        <p className="text-sm text-muted-foreground">
          {pkg.totalSessions} sesiones · {PAYMENT_MODE_LABELS[pkg.paymentMode]} · Creado el {formatDate(pkg.createdAt)}
        </p>
      </div>

      {isPackagePayment && (
        <div className="rounded-md border border-border p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Pago del paquete</h2>
          <p className="text-sm">
            Precio total: {formatMoney(pkg.packagePriceCents!, pkg.packagePriceCurrencyCode!)}
            {pkg.packagePriceCurrencyCode !== currencyCode && packagePriceLocalCents != null && (
              <> (≈ {formatMoney(packagePriceLocalCents, currencyCode)})</>
            )}
          </p>

          {pkg.transactions.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {pkg.transactions.map((t) => {
                const paidForeign = t.paidCurrencyCode === t.currencyForeign;
                const primaryCents = paidForeign ? t.amountForeignCents! : t.amountLocalCents;
                const primaryCurrency = paidForeign ? t.currencyForeign! : t.currencyLocal;
                const secondaryCents = paidForeign ? t.amountLocalCents : t.amountForeignCents;
                const secondaryCurrency = paidForeign ? t.currencyLocal : t.currencyForeign;
                return (
                  <div key={t.id} className="text-xs font-medium flex items-center gap-1.5">
                    <span>
                      ✓ {formatMoney(primaryCents, primaryCurrency)}
                      {secondaryCents != null && secondaryCurrency && (
                        <> ({formatMoney(secondaryCents, secondaryCurrency)})</>
                      )}{" "}
                      · {PAYMENT_METHOD_LABELS[t.paymentMethod]}
                      {t.reference && <> · Ref. {t.reference}</>}
                    </span>
                    <PaymentReceiptDialog
                      data={{
                        transactionId: t.id,
                        businessName,
                        clientName: `${pkg.client.firstName} ${pkg.client.lastName}`,
                        clientPhone: pkg.client.phone,
                        serviceName: pkg.service.name,
                        specialistName: pkg.specialist.displayName,
                        sessionLabel: `Paquete de ${pkg.totalSessions} sesiones`,
                        paidAt: t.paidAt,
                        amountLocalCents: t.amountLocalCents,
                        amountForeignCents: t.amountForeignCents,
                        paidCurrencyCode: t.paidCurrencyCode,
                        currencyLocal: t.currencyLocal,
                        currencyForeign: t.currencyForeign,
                        paymentMethod: t.paymentMethod,
                        reference: t.reference,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-sm font-medium">
            {fullyPaid
              ? "Pagado completo"
              : remainingLocalCents != null
                ? `Pendiente: ${formatMoney(remainingLocalCents, currencyCode)}`
                : null}
          </p>

          {showPaymentForm ? (
            <PaymentForm
              target={{ packageId: pkg.id }}
              defaultAmount={(remainingLocalCents ?? packagePriceLocalCents ?? 0) / 100}
              fxEnabled={fxEnabled}
              localCurrencyCode={currencyCode}
              foreignCurrencyCode={foreignCurrencyCode}
              rate={rate}
              onDone={() => setShowPaymentForm(false)}
            />
          ) : (
            !fullyPaid && (
              <button
                type="button"
                onClick={() => setShowPaymentForm(true)}
                className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100 text-left"
              >
                {pkg.transactions.length > 0 ? "Agregar otro pago" : "Registrar pago"}
              </button>
            )
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Sesiones</h2>
        {pkg.appointments.map((a) => (
          <div
            key={a.id}
            className={`rounded-md border px-3 py-2 flex items-center justify-between gap-3 ${APPOINTMENT_STATUS_STYLES[a.status]}`}
          >
            <div>
              <p className="text-sm font-medium">
                Sesión {a.sessionNumber} · {formatDate(a.startsAt)} {formatTime(a.startsAt)}
              </p>
              <Link
                href={`/agenda?date=${toDateKey(a.startsAt)}`}
                className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
              >
                Ver en agenda
              </Link>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CopyCancelLinkButton cancelToken={a.cancelToken} />
              <select
                value={a.status}
                disabled={isPending}
                onChange={(e) => handleStatusChange(a.id, e.target.value as AppointmentStatus)}
                className="text-xs bg-transparent border-0 font-medium focus-visible:outline-none cursor-pointer"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s} className="bg-card text-foreground">
                    {APPOINTMENT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
