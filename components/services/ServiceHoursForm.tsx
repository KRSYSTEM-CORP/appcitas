"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateServiceHours, type ServiceHourItem } from "@/lib/actions/services";

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function ServiceHoursForm({
  serviceId,
  initialHasCustomHours,
  initialHours,
}: {
  serviceId: string;
  initialHasCustomHours: boolean;
  initialHours: ServiceHourItem[];
}) {
  const router = useRouter();
  const [hasCustomHours, setHasCustomHours] = useState(initialHasCustomHours);
  const [hours, setHours] = useState(initialHours);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateDay(weekday: number, patch: Partial<ServiceHourItem>) {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateServiceHours(serviceId, { hasCustomHours, hours });
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
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={hasCustomHours} onChange={(e) => setHasCustomHours(e.target.checked)} />
        Usar un horario propio para este servicio (en vez del horario general del negocio)
      </label>

      {hasCustomHours && (
        <div className="flex flex-col gap-2">
          {hours.map((h) => (
            <div key={h.weekday} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
              <span className="w-24 text-sm font-medium shrink-0">{WEEKDAY_LABELS[h.weekday]}</span>

              <label className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                <input
                  type="checkbox"
                  checked={h.isClosed}
                  onChange={(e) => updateDay(h.weekday, { isClosed: e.target.checked })}
                />
                No disponible
              </label>

              {!h.isClosed && (
                <>
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
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">Descanso</span>
                    <input
                      type="time"
                      value={h.breakStart ?? ""}
                      onChange={(e) => updateDay(h.weekday, { breakStart: e.target.value || null })}
                      className="rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
                    />
                    <span className="text-muted-foreground">a</span>
                    <input
                      type="time"
                      value={h.breakEnd ?? ""}
                      onChange={(e) => updateDay(h.weekday, { breakEnd: e.target.value || null })}
                      className="rounded border border-input bg-background px-2 py-1 text-sm tabular-nums"
                    />
                    {h.breakStart && (
                      <button
                        type="button"
                        onClick={() => updateDay(h.weekday, { breakStart: null, breakEnd: null })}
                        className="text-xs text-muted-foreground underline underline-offset-2"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-success">Horario guardado</p>}

      <Button onClick={handleSave} disabled={isPending} className="self-start">
        {isPending ? "Guardando..." : "Guardar horario"}
      </Button>
    </div>
  );
}
