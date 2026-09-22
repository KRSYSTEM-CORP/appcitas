"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { listPendingAppointments, syncPendingAppointments, type PendingAppointment } from "@/lib/offline/sync";

// Shows queued-offline-appointment status on the agenda page and auto-syncs
// them once the connection returns. Polls the local IndexedDB queue on an
// interval (rather than wiring an event bus) since that queue is the single
// source of truth and polling it is simple and cheap.
export function OfflineSyncBanner({ canManage = false }: { canManage?: boolean }) {
  const online = useOnlineStatus();
  const [pending, setPending] = useState<PendingAppointment[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setPending(await listPendingAppointments());
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncPendingAppointments();
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (online) sync();
    // Only when connectivity flips back on — sync() itself is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  if (!online) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
        Sin conexión — puedes seguir agendando
        {pending.length > 0 && `; ${pending.length} cita${pending.length === 1 ? "" : "s"} en espera`}
        , se sincronizará al reconectar.
      </div>
    );
  }

  if (pending.length === 0) return null;

  const withError = pending.find((p) => p.lastError);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span>
        {syncing
          ? "Sincronizando..."
          : `${pending.length} cita${pending.length === 1 ? "" : "s"} pendiente${pending.length === 1 ? "" : "s"} de sincronizar`}
        {withError && (
          <span className="block text-xs text-destructive">
            {withError.lastError}
            {canManage && (
              <>
                {" "}
                <Link href="/agenda/review" className="underline underline-offset-2">
                  Revisar
                </Link>
              </>
            )}
          </span>
        )}
      </span>
      <Button size="sm" variant="outline" disabled={syncing} onClick={sync}>
        Reintentar ahora
      </Button>
    </div>
  );
}
