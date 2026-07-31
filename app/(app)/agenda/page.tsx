import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { listAppointmentsInRange } from "@/lib/actions/appointments";
import { listActiveSpecialists } from "@/lib/actions/specialists";
import { getFxInfo } from "@/lib/actions/business";
import { requireSession } from "@/lib/session";
import { formatDate, formatDayLabel, toDateKey } from "@/lib/format";
import { RANGE_VIEWS, getRange, shiftDate, type RangeView } from "@/lib/date-range";

type AgendaView = RangeView;
const VIEWS = RANGE_VIEWS;

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-VE", { month: "long", year: "numeric" });

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const session = await requireSession();
  const { date, view: viewParam } = await searchParams;
  const dateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date());
  const view: AgendaView = VIEWS.some((v) => v.key === viewParam) ? (viewParam as AgendaView) : "day";

  const { start, end } = getRange(view, dateKey);

  const [appointments, specialists, fx] = await Promise.all([
    listAppointmentsInRange(start, end),
    listActiveSpecialists(),
    getFxInfo(),
  ]);

  const rangeLabel =
    view === "day"
      ? formatDayLabel(new Date(`${dateKey}T00:00:00`))
      : view === "week"
        ? `${formatDate(start)} – ${formatDate(new Date(end.getTime() - 24 * 60 * 60_000))}`
        : MONTH_LABEL_FORMATTER.format(start);

  return (
    <div className="flex flex-col gap-4 p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agenda de {session.businessName}</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{rangeLabel}</p>
        </div>
        <Link href={`/agenda/new?date=${dateKey}`} className={buttonVariants({})}>
          Nueva cita
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/agenda?view=${v.key}&date=${v.key === "day" ? toDateKey(new Date()) : dateKey}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                view === v.key ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/agenda?view=${view}&date=${shiftDate(view, dateKey, -1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Anterior
          </Link>
          <Link
            href={`/agenda?view=${view}&date=${toDateKey(new Date())}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Hoy
          </Link>
          <Link
            href={`/agenda?view=${view}&date=${shiftDate(view, dateKey, 1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Siguiente →
          </Link>
        </div>
      </div>

      {specialists.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Todavía no tienes especialistas activos.{" "}
          <Link href="/specialists/new" className="underline underline-offset-4">
            Crea uno
          </Link>{" "}
          para empezar a agendar citas.
        </p>
      ) : view === "day" ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${specialists.length}, minmax(220px, 1fr))` }}>
          {specialists.map((specialist) => {
            const dayAppointments = appointments.filter((a) => a.specialist.id === specialist.id);
            return (
              <div key={specialist.id} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {specialist.displayName}
                </h2>
                <div className="flex flex-col gap-2">
                  {dayAppointments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-md">
                      Sin citas
                    </p>
                  ) : (
                    dayAppointments.map((a) => (
                      <AppointmentCard
                        key={a.id}
                        appointment={a}
                        currencyCode={fx.localCurrencyCode}
                        fxEnabled={fx.fxEnabled}
                        foreignCurrencyCode={fx.foreignCurrencyCode}
                        rate={fx.rate}
                        businessName={session.businessName}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md">
          Sin citas en este período.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(
            appointments.reduce<Record<string, typeof appointments>>((groups, a) => {
              const key = toDateKey(a.startsAt);
              (groups[key] ??= []).push(a);
              return groups;
            }, {}),
          ).map(([groupDateKey, dayAppointments]) => (
            <div key={groupDateKey} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold capitalize">
                {formatDayLabel(new Date(`${groupDateKey}T00:00:00`))}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {dayAppointments.map((a) => (
                  <div key={a.id} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {a.specialist.displayName}
                    </span>
                    <AppointmentCard
                      appointment={a}
                      currencyCode={fx.localCurrencyCode}
                      fxEnabled={fx.fxEnabled}
                      foreignCurrencyCode={fx.foreignCurrencyCode}
                      rate={fx.rate}
                      businessName={session.businessName}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
