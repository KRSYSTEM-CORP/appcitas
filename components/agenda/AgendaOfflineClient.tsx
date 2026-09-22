"use client";

import { useEffect, useState } from "react";
import { OfflineSyncBanner } from "@/components/agenda/OfflineSyncBanner";
import { AppointmentFormOffline } from "@/components/agenda/AppointmentFormOffline";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STYLES } from "@/lib/format";
import { getAgendaSnapshot, type AgendaSnapshot } from "@/lib/offline/db";
import { readLastBusiness } from "@/lib/offline/use-agenda-sync";
import { zonedHM } from "@/lib/timezone";

// How stale a snapshot is allowed to look before the freshness note switches
// from "hace X minutos" to a plainer "hace más de un día" — purely
// cosmetic, doesn't block anything (staleness is handled by blocking +
// owner review at sync time, not by refusing to book here).
function timeAgoLabel(savedAt: string): string {
  const ms = Date.now() - new Date(savedAt).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

// The offline-only agenda screen — served by the service worker (see
// public/sw.js) when a navigation to "/", "/agenda" or this page itself
// fails because there's no network. Deliberately smaller than the real
// /agenda: no status changes, no reassigning a specialist, no payments, no
// week/month view — just today's schedule (read-only) and creating one
// walk-in appointment, which queues through lib/offline/sync.ts exactly like
// a mid-session connection drop already would. Everything it shows comes
// from the AgendaSnapshot the real (online) /agenda page keeps warm in
// IndexedDB (see lib/offline/use-agenda-sync.ts) — there is nothing to fetch
// from the server here, by design.
export function AgendaOfflineClient() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AgendaSnapshot | null>(null);

  useEffect(() => {
    const last = readLastBusiness();
    if (!last) {
      setLoading(false);
      return;
    }
    getAgendaSnapshot(last.businessId).then((snap) => {
      setSnapshot(snap ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>;
  }

  if (!snapshot) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 min-h-[60vh] p-6 text-center">
        <h2 className="text-lg font-semibold">Sin conexión</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Todavía no hay una agenda guardada en este dispositivo para trabajar sin internet.
          Conéctate una vez con este equipo para cargarla — después podrás seguir agendando
          aunque se corte la conexión.
        </p>
      </div>
    );
  }

  const sortedAppointments = [...snapshot.todayAppointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="flex flex-col gap-4 p-6 w-full max-w-5xl mx-auto">
      {/* canManage omitted (defaults false) — there's no live session to check
          role against while offline; the "Revisar" link only ever needs to
          appear once back online, from the real /agenda page below. */}
      <OfflineSyncBanner />
      <p className="text-xs text-muted-foreground text-center">
        Sin conexión — agenda guardada {timeAgoLabel(snapshot.savedAt)}. Las citas de otros equipos
        hechas después de eso pueden no estar aquí todavía.
      </p>

      <div>
        <h1 className="text-2xl font-semibold">Agenda de hoy — {snapshot.businessName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Solo lectura mientras no haya conexión.</p>
      </div>

      <div className="rounded-lg border border-border divide-y divide-border">
        {sortedAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin citas guardadas para hoy.</p>
        ) : (
          sortedAppointments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono tabular-nums text-sm shrink-0">{zonedHM(new Date(a.startsAt))}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.clientFirstName} {a.clientLastName} · {a.serviceName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.specialistName ?? "Sin asignar"} · {a.clientPhone}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${APPOINTMENT_STATUS_STYLES[a.status]}`}
              >
                {APPOINTMENT_STATUS_LABELS[a.status]}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="font-semibold mb-3">Nueva cita (walk-in)</h2>
        <AppointmentFormOffline snapshot={snapshot} />
      </div>
    </div>
  );
}
