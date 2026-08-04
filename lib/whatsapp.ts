import { formatDayLabel, formatTime } from "@/lib/format";

// wa.me needs digits only; this assumes the phone was entered with a
// country code (e.g. "+58 412 1234567"). A purely local number won't
// resolve to a chat — that's a limit of not having verified E.164 numbers,
// not something worth guessing a country code for.
export function buildWhatsAppReminderLink(input: {
  phone: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  startsAt: Date;
  cancelUrl?: string;
}): string {
  const digits = input.phone.replace(/\D/g, "");
  const message =
    `Hola ${input.clientName}, te escribimos de ${input.businessName} para recordarte tu cita de ` +
    `${input.serviceName} el ${formatDayLabel(input.startsAt)} a las ${formatTime(input.startsAt)}. ` +
    `¡Te esperamos!` +
    (input.cancelUrl ? ` Si no puedes asistir, cancela aquí: ${input.cancelUrl}` : "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// Same manual "open wa.me and hit send" pattern as the reminder link above —
// there's no real WhatsApp Business API wired up (see the AGENDA feature
// discussion), so "send a confirmation message" stays a one-click manual
// action for staff rather than something that fires on its own when the
// status changes to CONFIRMED.
export function buildWhatsAppConfirmationLink(input: {
  phone: string;
  clientName: string;
  businessName: string;
  serviceName: string;
  startsAt: Date;
}): string {
  const digits = input.phone.replace(/\D/g, "");
  const message =
    `Hola ${input.clientName}, te escribimos de ${input.businessName} para confirmarte tu cita de ` +
    `${input.serviceName} el ${formatDayLabel(input.startsAt)} a las ${formatTime(input.startsAt)}. ` +
    `¡Te esperamos!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// CRM reactivation message — same manual wa.me pattern as the reminder and
// confirmation links above, opened for staff to review and send themselves
// rather than fired automatically. lastServiceName/lastVisit are omitted for
// a client with no attended appointment yet (see listClientsForCrm).
export function buildWhatsAppPromoLink(input: {
  phone: string;
  clientName: string;
  businessName: string;
  lastServiceName?: string | null;
  lastVisit?: Date | null;
  bookingUrl?: string;
}): string {
  const digits = input.phone.replace(/\D/g, "");
  const intro =
    input.lastServiceName && input.lastVisit
      ? `Notamos que tu última visita fue el ${formatDayLabel(input.lastVisit)} para ${input.lastServiceName} y nos encantaría atenderte de nuevo.`
      : "Queríamos saludarte y contarte que nos encantaría atenderte.";
  const message =
    `Hola ${input.clientName}, te saluda ${input.businessName}. ${intro} ` +
    `Seguimos aquí para servirte con todos nuestros servicios` +
    (input.bookingUrl ? ` — puedes agendar tu próxima cita aquí: ${input.bookingUrl}` : ", ¡escríbenos para agendar!") +
    ` ¡Será un gusto recibirte pronto!`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
