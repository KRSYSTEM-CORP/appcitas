import { toDateKey } from "@/lib/format";

// Shared by Agenda and Paquetes — both browse their data through the same
// day/week/month toggle, so the range math (and its "day-key" pivot) lives
// in one place instead of being redefined per page.
export type RangeView = "day" | "week" | "month";

export const RANGE_VIEWS: { key: RangeView; label: string }[] = [
  { key: "day", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

export function addDays(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function addMonths(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  return toDateKey(d);
}

// Sunday-Saturday, matching BusinessHour's weekday numbering (0=domingo).
function weekStart(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return addDays(dateKey, -d.getDay());
}

export function getRange(view: RangeView, dateKey: string): { start: Date; end: Date } {
  if (view === "day") {
    const start = new Date(`${dateKey}T00:00:00`);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
  }
  if (view === "week") {
    const start = new Date(`${weekStart(dateKey)}T00:00:00`);
    return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60_000) };
  }
  const d = new Date(`${dateKey}T00:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

export function shiftDate(view: RangeView, dateKey: string, delta: number): string {
  if (view === "day") return addDays(dateKey, delta);
  if (view === "week") return addDays(dateKey, delta * 7);
  return addMonths(dateKey, delta);
}
