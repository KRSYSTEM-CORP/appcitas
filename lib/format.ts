import type { AppointmentStatus, PaymentMethod } from "@prisma/client";
import { SHOP_TIME_ZONE } from "@/lib/timezone";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  PAGO_MOVIL: "Pago Móvil",
  BINANCE: "Binance",
  OTHER: "Otro",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  ATTENDED: "Asistió",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelada",
};

// Tailwind classes per status — semantic color, independent of the
// business's own accent (see components/ui — chips read state at a glance).
export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, string> = {
  PENDING: "bg-warning/15 text-warning border-warning/30",
  CONFIRMED: "bg-primary/15 text-primary border-primary/30",
  ATTENDED: "bg-success/15 text-success border-success/30",
  NO_SHOW: "bg-muted text-muted-foreground border-border",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30 line-through decoration-1",
};

export function formatMoney(cents: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: currencyCode }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currencyCode}`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

// Pinned to SHOP_TIME_ZONE (not the runtime's own clock) so the time shown
// is always the real Venezuela-local one — otherwise a server component
// rendered on Vercel (UTC) can show a time up to 4 hours off from what the
// user's own device says, and differ from what the same value renders as
// once a client component hydrates in the browser.
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit", timeZone: SHOP_TIME_ZONE }).format(d);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: SHOP_TIME_ZONE,
  }).format(d);
}

export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("es-VE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: SHOP_TIME_ZONE,
  }).format(date);
}

// YYYY-MM-DD read via the runtime's OWN local clock — reserved for the pure
// calendar-string arithmetic in lib/date-range.ts (adding/subtracting days
// from an already-known dateKey), which never touches a real timestamp and
// stays internally self-consistent regardless of what "local" means here.
// For anything that starts from a REAL instant (Appointment.startsAt,
// `new Date()` as "right now") use dateKeyOf()/todayDateKey() from
// lib/timezone.ts instead — this function would silently return the wrong
// calendar day for those (e.g. an appointment at 22:00 Caracas already being
// past UTC midnight the next day).
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
