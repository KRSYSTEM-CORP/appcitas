"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  discardPendingAppointment,
  listPendingAppointments,
  syncPendingAppointments,
  type PendingAppointment,
} from "@/lib/offline/sync";

// A queued offline appointment only ever fails to sync for a real reason —
// createAppointment's own server-side conflict re-check is what blocks it
// (see lib/actions/appointments.ts and lib/offline/sync.ts) — never a
// silent double-booking. This screen is where that block gets resolved by
// hand, since it represents a client who was already told "sí, tienes
// espacio": retry once resolved (e.g. reassigning the specialist), or
// discard it explicitly, which never happens automatically. Discarding uses
// window.confirm rather than a modal dialog — this app has no dialog
// component (see components/clients/DeleteClientButton.tsx for the same
// pattern).
export function PendingAppointmentReview() {
  const [pending, setPending] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await listPendingAppointments();
    setPending(all.filter((a) => a.lastError));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function retry(localId: string) {
    setSyncingId(localId);
    try {
      // syncPendingAppointments() replays the whole queue, not just this one
      // — there's no per-appointment entry point today, and re-trying
      // everything is harmless (one that already synced simply isn't in the
      // queue anymore).
      await syncPendingAppointments();
    } finally {
      setSyncingId(null);
      await refresh();
    }
  }

  async function discard(appointment: PendingAppointment) {
    if (
      !window.confirm(
        `¿Descartar la cita de ${appointment.preview.clientName}? Esto no se puede deshacer — asegúrate de haberlo resuelto con el cliente antes de continuar.`
      )
    ) {
      return;
    }
    await discardPendingAppointment(appointment.localId);
    await refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando...</p>;
  }

  if (pending.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay citas pendientes de revisión — todas las citas hechas sin conexión se sincronizaron
        correctamente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pending.map((appointment) => (
        <div key={appointment.localId} className="rounded-lg border border-border p-4 flex flex-col gap-2">
          <div>
            <p className="font-medium">
              {appointment.preview.clientName} · {appointment.preview.serviceName}
            </p>
            <p className="text-xs text-muted-foreground">
              {appointment.preview.dateKey} {appointment.preview.time} ·{" "}
              {appointment.preview.specialistName ?? "Sin asignar"} · {appointment.preview.clientPhone}
            </p>
            <p className="text-xs text-muted-foreground">
              Encolada el {new Date(appointment.queuedAt).toLocaleString("es")}
            </p>
          </div>
          <p className="text-sm text-destructive">{appointment.lastError}</p>
          <div className="flex justify-end gap-2 mt-1">
            <Button size="sm" variant="destructive" onClick={() => discard(appointment)}>
              Descartar
            </Button>
            <Button size="sm" disabled={syncingId === appointment.localId} onClick={() => retry(appointment.localId)}>
              {syncingId === appointment.localId ? "Reintentando..." : "Reintentar"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
