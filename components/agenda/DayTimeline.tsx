import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STYLES, formatTime } from "@/lib/format";
import type { AppointmentListItem } from "@/lib/actions/appointments";
import type { DayHours } from "@/lib/actions/business";

const PIXELS_PER_HOUR = 64;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const period = h < 12 ? "a. m." : "p. m.";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH} ${period}`;
}

// Read-at-a-glance day view: one column per specialist, business hours as
// the vertical axis, appointments positioned by their real start/duration so
// free gaps are just whatever's left unshaded. The break window (if any) is
// shaded the same way an appointment would be. Purely visual/read-only — the
// existing AppointmentCard list below still handles clicking into or
// changing a specific appointment.
export function DayTimeline({
  specialists,
  appointments,
  hours,
}: {
  specialists: { id: string; displayName: string }[];
  appointments: AppointmentListItem[];
  hours: DayHours | null;
}) {
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        El negocio no abre este día.
      </div>
    );
  }

  const dayStartMinutes = toMinutes(hours.opensAt);
  const dayEndMinutes = toMinutes(hours.closesAt);
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  if (totalMinutes <= 0) return null;

  const breakRange =
    hours.breakStart && hours.breakEnd
      ? { start: toMinutes(hours.breakStart), end: toMinutes(hours.breakEnd) }
      : null;

  const hourMarks: number[] = [];
  for (let h = Math.ceil(dayStartMinutes / 60); h <= Math.floor(dayEndMinutes / 60); h++) {
    hourMarks.push(h * 60);
  }

  function topPct(minutes: number) {
    return Math.max(0, Math.min(100, ((minutes - dayStartMinutes) / totalMinutes) * 100));
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-x-auto">
      <div className="flex" style={{ minHeight: (totalMinutes / 60) * PIXELS_PER_HOUR }}>
        <div className="w-14 shrink-0 relative border-r border-border">
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute left-0 right-0 -translate-y-1/2 text-[10px] text-muted-foreground text-right pr-1.5"
              style={{ top: `${topPct(m)}%` }}
            >
              {formatHourLabel(m)}
            </div>
          ))}
        </div>
        <div
          className="flex-1 grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(specialists.length, 1)}, minmax(160px, 1fr))` }}
        >
          {specialists.map((specialist) => {
            const specialistAppointments = appointments.filter(
              (a) => a.specialist.id === specialist.id && a.status !== "CANCELLED",
            );
            return (
              <div key={specialist.id} className="relative border-r border-border last:border-r-0">
                {hourMarks.map((m) => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 border-t border-border/60"
                    style={{ top: `${topPct(m)}%` }}
                  />
                ))}
                {breakRange && (
                  <div
                    className="absolute left-0 right-0 bg-muted/50 flex items-center justify-center pointer-events-none"
                    style={{
                      top: `${topPct(breakRange.start)}%`,
                      height: `${topPct(breakRange.end) - topPct(breakRange.start)}%`,
                    }}
                  >
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Descanso</span>
                  </div>
                )}
                {specialistAppointments.map((a) => {
                  const startMinutes = a.startsAt.getHours() * 60 + a.startsAt.getMinutes();
                  const endMinutes = a.endsAt.getHours() * 60 + a.endsAt.getMinutes();
                  const top = topPct(startMinutes);
                  const height = Math.max(topPct(endMinutes) - top, 2);
                  return (
                    <div
                      key={a.id}
                      className={`absolute left-1 right-1 rounded border px-1.5 py-0.5 overflow-hidden text-[11px] leading-tight ${APPOINTMENT_STATUS_STYLES[a.status]}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                      title={`${a.client.firstName} ${a.client.lastName} · ${a.service.name} · ${APPOINTMENT_STATUS_LABELS[a.status]}`}
                    >
                      <span className="font-medium">{formatTime(a.startsAt)}</span> {a.client.firstName}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
