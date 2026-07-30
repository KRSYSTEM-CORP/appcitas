import type { AppointmentStatus, PaymentMethod } from "@prisma/client";

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

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-VE", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat("es-VE", { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

// YYYY-MM-DD in local time (not UTC) — used for <input type="date"> values
// and for building a day's start/end boundaries.
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
