import { formatMoney } from "@/lib/format";
import { todayDateKey } from "@/lib/timezone";

export function RevenueChart({
  data,
  currencyCode,
}: {
  data: { dateKey: string; cents: number }[];
  currencyCode: string;
}) {
  const max = Math.max(...data.map((d) => d.cents), 1);
  const todayKey = todayDateKey();

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-end gap-1.5 h-40 border-b border-border">
        {data.map((d) => {
          const heightPct = Math.max((d.cents / max) * 100, d.cents > 0 ? 4 : 0);
          const isToday = d.dateKey === todayKey;
          return (
            <div key={d.dateKey} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative">
              <div
                title={`${formatMoney(d.cents, currencyCode)} — ${d.dateKey}`}
                className={`w-full rounded-t-sm transition-colors ${
                  isToday ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/70"
                }`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1">
        {data.map((d) => (
          <span key={d.dateKey} className="flex-1 text-center text-[10px] text-muted-foreground tabular-nums">
            {new Date(`${d.dateKey}T00:00:00`).getDate()}
          </span>
        ))}
      </div>
    </div>
  );
}
