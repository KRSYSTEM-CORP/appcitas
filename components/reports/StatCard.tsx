export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
