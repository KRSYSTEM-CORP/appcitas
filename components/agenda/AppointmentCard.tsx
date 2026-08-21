"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, MessageCircleCheck } from "lucide-react";
import { assignSpecialist, updateAppointmentStatus, type AppointmentListItem } from "@/lib/actions/appointments";
import { PaymentForm } from "@/components/agenda/PaymentForm";
import { CopyCancelLinkButton } from "@/components/shared/CopyCancelLinkButton";
import { PaymentReceiptDialog } from "@/components/shared/PaymentReceiptDialog";
import { serviceLocalPriceCents } from "@/lib/pricing";
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_STYLES,
  PAYMENT_METHOD_LABELS,
  formatMoney,
  formatTime,
} from "@/lib/format";
import { buildWhatsAppConfirmationLink, buildWhatsAppReminderLink } from "@/lib/whatsapp";
import type { AppointmentStatus } from "@prisma/client";

const STATUS_OPTIONS: AppointmentStatus[] = ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"];

export function AppointmentCard({
  appointment,
  currencyCode,
  fxEnabled,
  foreignCurrencyCode,
  rate,
  businessName,
  qualifiedSpecialists = [],
}: {
  appointment: AppointmentListItem;
  currencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  rate: number | null;
  businessName: string;
  // Specialists who can perform this appointment's service — only needed
  // when appointment.specialist is null, to populate the "Asignar a" picker.
  qualifiedSpecialists?: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  function handleAssign(specialistId: string) {
    if (!specialistId) return;
    setAssignError(null);
    setAssigning(true);
    startTransition(async () => {
      const result = await assignSpecialist(appointment.id, specialistId);
      setAssigning(false);
      if (!result.success) {
        setAssignError(result.error);
        return;
      }
      router.refresh();
    });
  }
  // Filled in after mount, not during render, so the client's first render
  // still matches the server-rendered HTML (window is unavailable server-side).
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => startTransition(() => setOrigin(window.location.origin)), []);

  function handleStatusChange(status: AppointmentStatus) {
    startTransition(async () => {
      await updateAppointmentStatus(appointment.id, status);
      router.refresh();
    });
  }

  const clientName = `${appointment.client.firstName} ${appointment.client.lastName}`;
  const whatsappLink = buildWhatsAppReminderLink({
    phone: appointment.client.phone,
    clientName,
    businessName,
    serviceName: appointment.service.name,
    startsAt: appointment.startsAt,
    cancelUrl: origin ? `${origin}/cancel/${appointment.cancelToken}` : undefined,
  });
  const confirmationWhatsappLink = buildWhatsAppConfirmationLink({
    phone: appointment.client.phone,
    clientName,
    businessName,
    serviceName: appointment.service.name,
    startsAt: appointment.startsAt,
  });

  const localPriceCents =
    serviceLocalPriceCents(appointment.service, { localCurrencyCode: currencyCode }, rate) ??
    appointment.service.basePriceCents;
  const paidLocalCents = appointment.transactions.reduce((sum, t) => sum + t.amountLocalCents, 0);
  const remainingLocalCents = Math.max(0, localPriceCents - paidLocalCents);
  const fullyPaid = appointment.transactions.length > 0 && remainingLocalCents <= 0;
  // When a session belongs to a package paid as a whole, payment lives on
  // the Package (not this Appointment) — see components/packages/PackageDetailView.
  const isPackagePayment = appointment.sessionPackage?.paymentMode === "PACKAGE";

  return (
    <div className={`rounded-md border px-3 py-2 flex flex-col gap-1 ${APPOINTMENT_STATUS_STYLES[appointment.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">
          {formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}
        </span>
        <select
          value={appointment.status}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value as AppointmentStatus)}
          className="text-xs bg-transparent border-0 font-medium focus-visible:outline-none cursor-pointer"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="bg-card text-foreground">
              {APPOINTMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          {clientName}
          {appointment.sessionPackage && (
            <Link
              href={`/packages/${appointment.sessionPackage.id}`}
              className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-current px-1.5 py-0.5 opacity-70 hover:opacity-100"
              title="Ver paquete"
            >
              Sesión {appointment.sessionNumber}/{appointment.sessionPackage.totalSessions}
            </Link>
          )}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <CopyCancelLinkButton cancelToken={appointment.cancelToken} />
          {appointment.status === "CONFIRMED" && (
            <a
              href={confirmationWhatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Enviar confirmación por WhatsApp"
              className="opacity-70 hover:opacity-100"
            >
              <MessageCircleCheck className="size-4" />
            </a>
          )}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            title="Enviar recordatorio por WhatsApp"
            className="opacity-70 hover:opacity-100"
          >
            <MessageCircle className="size-4" />
          </a>
        </div>
      </div>

      {!appointment.specialist && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full border border-current px-1.5 py-0.5 opacity-70">
            Sin asignar
          </span>
          <select
            disabled={assigning}
            defaultValue=""
            onChange={(e) => handleAssign(e.target.value)}
            className="text-xs bg-transparent border border-current rounded px-1 py-0.5 opacity-80 focus-visible:outline-none cursor-pointer"
          >
            <option value="" disabled>
              Asignar a…
            </option>
            {qualifiedSpecialists.map((s) => (
              <option key={s.id} value={s.id} className="bg-card text-foreground">
                {s.displayName}
              </option>
            ))}
          </select>
          {assignError && <span className="text-xs text-destructive">{assignError}</span>}
        </div>
      )}

      <p className="text-xs opacity-80">
        {appointment.service.name} ·{" "}
        {formatMoney(appointment.service.basePriceCents, appointment.service.priceCurrencyCode)}
        {appointment.service.priceCurrencyCode !== currencyCode && (
          <> (≈ {formatMoney(localPriceCents, currencyCode)})</>
        )}
      </p>
      {appointment.notes && <p className="text-xs opacity-70 italic">{appointment.notes}</p>}

      {isPackagePayment ? (
        <Link
          href={`/packages/${appointment.sessionPackage!.id}`}
          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100 text-left mt-1"
        >
          Este paquete se paga en un solo pago — ver estado en el paquete
        </Link>
      ) : (
        <>
          {appointment.transactions.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-1">
              {appointment.transactions.map((t) => {
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
                        clientName,
                        clientPhone: appointment.client.phone,
                        serviceName: appointment.service.name,
                        specialistName: appointment.specialist?.displayName ?? "Sin asignar",
                        sessionLabel: appointment.sessionPackage
                          ? `Sesión ${appointment.sessionNumber}/${appointment.sessionPackage.totalSessions}`
                          : null,
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
              <p className="text-xs opacity-80">
                {fullyPaid ? "Pagado completo" : `Pendiente: ${formatMoney(remainingLocalCents, currencyCode)}`}
              </p>
            </div>
          )}

          {showPaymentForm ? (
            <div className="mt-1">
              <PaymentForm
                target={{ appointmentId: appointment.id }}
                defaultAmount={(remainingLocalCents > 0 ? remainingLocalCents : localPriceCents) / 100}
                fxEnabled={fxEnabled}
                localCurrencyCode={currencyCode}
                foreignCurrencyCode={foreignCurrencyCode}
                rate={rate}
                onDone={() => setShowPaymentForm(false)}
              />
            </div>
          ) : (
            !fullyPaid && (
              <button
                type="button"
                onClick={() => setShowPaymentForm(true)}
                className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100 text-left mt-1"
              >
                {appointment.transactions.length > 0 ? "Agregar otro pago" : "Registrar pago"}
              </button>
            )
          )}
        </>
      )}
    </div>
  );
}
