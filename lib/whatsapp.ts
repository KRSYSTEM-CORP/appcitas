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
