import Link from "next/link";
import { getReportsSummary, type ReportPeriod } from "@/lib/actions/reports";
import { StatCard } from "@/components/reports/StatCard";
import { RevenueChart } from "@/components/reports/RevenueChart";
import { ClientsSegmentView } from "@/components/reports/ClientsSegmentView";
import { formatMoney } from "@/lib/format";

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: "day", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
];

const PERIOD_NOUN: Record<ReportPeriod, string> = { day: "hoy", week: "esta semana", month: "este mes" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: periodParam } = await searchParams;
  const period: ReportPeriod = PERIODS.some((p) => p.key === periodParam) ? (periodParam as ReportPeriod) : "month";
  const report = await getReportsSummary(period);

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reportes</h1>
          <p className="text-sm text-muted-foreground mt-1">Ingresos, servicios más pedidos y clientes.</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/reports?period=${p.key}`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.key ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Citas hoy" value={String(report.appointmentsToday)} />
        <StatCard label={`Citas ${PERIOD_NOUN[period]}`} value={String(report.appointmentsInPeriod)} />
        <StatCard
          label={`Ingresos ${PERIOD_NOUN[period]}`}
          value={formatMoney(report.periodRevenueLocalCents, report.currencyCode)}
        />
        <StatCard
          label="Nuevos / recurrentes"
          value={`${report.newClientsCount} / ${report.recurringClientsCount}`}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ingresos por moneda ({PERIOD_NOUN[period]})</h2>
        {report.revenueByCurrency.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pagos registrados en este período.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.revenueByCurrency.map((r) => (
              <StatCard key={r.currencyCode} label={r.currencyCode} value={formatMoney(r.cents, r.currencyCode)} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ingresos — últimos 14 días</h2>
        <RevenueChart data={report.dailyRevenue} currencyCode={report.currencyCode} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Servicios más pedidos ({PERIOD_NOUN[period]})</h2>
        {report.topServices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay citas en este período.</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            {report.topServices.map((s, i) => (
              <div key={s.name} className={`flex justify-between px-4 py-2 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
                <span>{s.name}</span>
                <span className="tabular-nums text-muted-foreground">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Clientes ({PERIOD_NOUN[period]})</h2>
        <ClientsSegmentView newClients={report.newClients} recurringClients={report.recurringClients} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Clientes nuevos y recurrentes por servicio ({PERIOD_NOUN[period]})</h2>
        {report.clientsByService.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay citas en este período.</p>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Servicio</th>
                  <th className="px-4 py-2 font-medium text-right">Nuevos</th>
                  <th className="px-4 py-2 font-medium text-right">Recurrentes</th>
                </tr>
              </thead>
              <tbody>
                {report.clientsByService.map((s) => (
                  <tr key={s.serviceId} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">{s.serviceName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.newClients}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.recurringClients}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
