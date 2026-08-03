import { zonedMidnightUtc, weekdayOf } from "@/lib/timezone";

// Shared by Agenda and Paquetes — both browse their data through the same
// day/week/month toggle, so the range math (and its "day-key" pivot) lives
// in one place instead of being redefined per page.
export type RangeView = "day" | "week" | "month";

export const RANGE_VIEWS: { key: RangeView; label: string }[] = [
  { key: "day", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

// Pure "YYYY-MM-DD" arithmetic — deliberately explicit UTC (Date.UTC /
// getUTC*), never the runtime's own local clock, so shifting a dateKey by N
// days/months is correct regardless of what zone the process happens to run
// in. This never touches a real instant or SHOP_TIME_ZONE; it's just Y-M-D
// bookkeeping on a string (the actual real-world day boundaries are computed
// separately in getRange, below).
export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + delta));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function addMonths(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + delta, d));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

// Sunday-Saturday, matching BusinessHour's weekday numbering (0=domingo).
function weekStart(dateKey: string): string {
  return addDays(dateKey, -weekdayOf(dateKey));
}

// start/end are real UTC instants marking true Caracas-local day/week/month
// boundaries — used directly as Prisma range filters against Appointment/
// Transaction timestamps, so getting this wrong doesn't just mislabel a
// header, it silently drops or includes the wrong appointments near either
// boundary (e.g. a 11pm Caracas booking near midnight).
export function getRange(view: RangeView, dateKey: string): { start: Date; end: Date } {
  if (view === "day") {
    const start = zonedMidnightUtc(dateKey);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60_000) };
  }
  if (view === "week") {
    const start = zonedMidnightUtc(weekStart(dateKey));
    return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60_000) };
  }
  const [y, m] = dateKey.split("-").map(Number);
  const monthStartKey = `${y}-${String(m).padStart(2, "0")}-01`;
  return { start: zonedMidnightUtc(monthStartKey), end: zonedMidnightUtc(addMonths(monthStartKey, 1)) };
}

export function shiftDate(view: RangeView, dateKey: string, delta: number): string {
  if (view === "day") return addDays(dateKey, delta);
  if (view === "week") return addDays(dateKey, delta * 7);
  return addMonths(dateKey, delta);
}
