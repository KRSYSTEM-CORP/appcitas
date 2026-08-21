"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateBusinessHours, type BusinessConfig } from "@/lib/actions/business";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function BusinessHoursForm({ initialHours }: { initialHours: BusinessConfig["hours"] }) {
  const router = useRouter();
  const [hours, setHours] = useState(initialHours);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateDay(weekday: number, patch: Partial<BusinessConfig["hours"][number]>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateBusinessHours(hours);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      {hours.map((h) => (
        <div key={h.weekday} className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{WEEKDAY_LABELS[h.weekday]}</span>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={h.isClosed}
                onChange={(e) => updateDay(h.weekday, { isClosed: e.target.checked })}
              />
              Cerrado
            </label>
          </div>

          {!h.isClosed && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-16 shrink-0">Horario</span>
                <input
                  type="time"
                  value={h.opensAt ?? ""}
                  onChange={(e) => updateDay(h.weekday, { opensAt: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
                />
                <span className="text-muted-foreground shrink-0">a</span>
                <input
                  type="time"
                  value={h.closesAt ?? ""}
                  onChange={(e) => updateDay(h.weekday, { closesAt: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
                />
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted-foreground w-16 shrink-0">Descanso</span>
                <input
                  type="time"
                  value={h.breakStart ?? ""}
                  onChange={(e) => updateDay(h.weekday, { breakStart: e.target.value || null })}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
                />
                <span className="text-muted-foreground shrink-0">a</span>
                <input
                  type="time"
                  value={h.breakEnd ?? ""}
                  onChange={(e) => updateDay(h.weekday, { breakEnd: e.target.value || null })}
                  className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
                />
                {h.breakStart && (
                  <button
                    type="button"
                    onClick={() => updateDay(h.weekday, { breakStart: null, breakEnd: null })}
                    className="text-xs text-muted-foreground underline underline-offset-2 shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        El descanso (ej. almuerzo) es opcional — déjalo vacío si el horario es continuo.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-success">Horario guardado</p>}

      <Button onClick={handleSave} disabled={isPending} className="self-start">
        {isPending ? "Guardando..." : "Guardar horario"}
      </Button>
    </div>
  );
}
