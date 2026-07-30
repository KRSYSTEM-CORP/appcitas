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
    <div className="flex flex-col gap-3 max-w-lg">
      {hours.map((h) => (
        <div key={h.weekday} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
          <span className="w-24 text-sm font-medium shrink-0">{WEEKDAY_LABELS[h.weekday]}</span>

          <label className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
            <input
              type="checkbox"
              checked={h.isClosed}
              onChange={(e) => updateDay(h.weekday, { isClosed: e.target.checked })}
            />
            Cerrado
          </label>

          {!h.isClosed && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="time"
                value={h.opensAt ?? ""}
                onChange={(e) => updateDay(h.weekday, { opensAt: e.target.value })}
                className="rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
              />
              <span className="text-muted-foreground">a</span>
              <input
                type="time"
                value={h.closesAt ?? ""}
                onChange={(e) => updateDay(h.weekday, { closesAt: e.target.value })}
                className="rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
              />
            </div>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-success">Horario guardado</p>}

      <Button onClick={handleSave} disabled={isPending} className="self-start">
        {isPending ? "Guardando..." : "Guardar horario"}
      </Button>
    </div>
  );
}
