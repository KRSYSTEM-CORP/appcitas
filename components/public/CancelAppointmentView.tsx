"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelAppointmentByToken } from "@/lib/actions/public";
import { formatDayLabel, formatTime } from "@/lib/format";
import type { PublicAppointmentInfo } from "@/lib/actions/public";

export function CancelAppointmentView({ appointment, token }: { appointment: PublicAppointmentInfo; token: string }) {
  const [status, setStatus] = useState(appointment.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelAppointmentByToken(token);
      if (result.success) {
        setStatus("CANCELLED");
      } else {
        setError(result.error);
      }
    });
  }

  if (status === "CANCELLED") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Cita cancelada</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Tu cita de {appointment.service.name} en {appointment.business.name} fue cancelada.
        </p>
      </div>
    );
  }

  if (status === "ATTENDED") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Esta cita ya fue atendida</h1>
        <p className="text-sm text-muted-foreground max-w-sm">Ya no se puede cancelar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">¿Cancelar tu cita?</h1>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">
          {appointment.client.firstName}, tu cita de {appointment.service.name} en {appointment.business.name} es el{" "}
          {formatDayLabel(appointment.startsAt)} a las {formatTime(appointment.startsAt)}.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" variant="destructive" onClick={handleCancel} disabled={isPending}>
        {isPending ? "Cancelando..." : "Sí, cancelar mi cita"}
      </Button>
    </div>
  );
}
