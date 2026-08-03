// The server (Vercel) always runs with TZ=UTC, regardless of where the
// business actually operates — confirmed empirically against production.
// Every function here exists to pin date/time math to the business's real
// wall-clock zone instead of silently drifting to whatever the runtime's
// ambient clock happens to be. Mirrors the SHOP_TIME_ZONE pattern already
// proven out in the App Finanzas sibling app's lib/report-types.ts.
export const SHOP_TIME_ZONE = "America/Caracas";

export function zonedDateParts(instant: Date, timeZone: string = SHOP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

// "YYYY-MM-DD" of a real instant, in `timeZone` — use this (not
// lib/format.ts's toDateKey) whenever the input is a real timestamp like
// Appointment.startsAt or `new Date()`. toDateKey stays reserved for pure
// calendar-string arithmetic (lib/date-range.ts) that never touches a real
// instant, so it doesn't need — and must not go through — a timezone
// conversion.
export function dateKeyOf(instant: Date, timeZone: string = SHOP_TIME_ZONE): string {
  const { year, month, day } = zonedDateParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayDateKey(timeZone: string = SHOP_TIME_ZONE): string {
  return dateKeyOf(new Date(), timeZone);
}

function offsetMsAt(guessUtcInstant: Date, timeZone: string): number {
  const asUtc = new Date(guessUtcInstant.toLocaleString("en-US", { timeZone: "UTC" }));
  const asZoned = new Date(guessUtcInstant.toLocaleString("en-US", { timeZone }));
  return asUtc.getTime() - asZoned.getTime();
}

// Converts a "YYYY-MM-DD" + "HH:mm" wall-clock reading in `timeZone` into the
// real UTC instant it represents — e.g. "09:00" in America/Caracas (UTC-4)
// becomes 13:00 UTC, not 09:00 UTC. Without this, a naive
// `new Date(`${dateKey}T${time}:00`)` on a UTC server silently treats a
// Caracas wall-clock time as if it were already UTC, storing every
// appointment 4 hours off from what was actually typed. Returns an Invalid
// Date (never throws) if either input is malformed, same as a bad native
// Date parse would.
export function zonedTimeToUtc(dateKey: string, time: string, timeZone: string = SHOP_TIME_ZONE): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return new Date(NaN);
  const [, y, mo, d] = dateMatch;
  const [, hh, mm] = timeMatch;
  const guess = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)));
  return new Date(guess.getTime() + offsetMsAt(guess, timeZone));
}

export function zonedMidnightUtc(dateKey: string, timeZone: string = SHOP_TIME_ZONE): Date {
  return zonedTimeToUtc(dateKey, "00:00", timeZone);
}

// The weekday (0=domingo..6=sábado) of a plain "YYYY-MM-DD" calendar date —
// unambiguous and zone-agnostic since it never touches a real instant.
export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

// "HH:mm" of a real instant, in `timeZone` — the display-side counterpart to
// zonedTimeToUtc above (e.g. formatting a generated slot back to the wall
// clock time a person should see, regardless of the runtime's own clock).
export function zonedHM(instant: Date, timeZone: string = SHOP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some ICU implementations use 24 for midnight under hour12:false
  return `${hour}:${get("minute")}`;
}

// Minutes since local midnight of a real instant, in `timeZone` — used to
// position an appointment block on a percentage-based day timeline without
// ever reading the runtime's own (wrong) idea of "the hour".
export function zonedMinutesOfDay(instant: Date, timeZone: string = SHOP_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0;
  return hour * 60 + get("minute");
}
