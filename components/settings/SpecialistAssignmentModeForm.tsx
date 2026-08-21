"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSpecialistAssignmentMode } from "@/lib/actions/business";
import type { SpecialistAssignmentMode } from "@prisma/client";

export function SpecialistAssignmentModeForm({ initialMode }: { initialMode: SpecialistAssignmentMode }) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(next: SpecialistAssignmentMode) {
    if (next === mode) return;
    setError(null);
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await updateSpecialistAssignmentMode(next);
      if (!result.success) {
        setMode(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border p-1 text-sm max-w-sm">
        <button
          type="button"
          disabled={isPending}
          onClick={() => choose("CLIENT_CHOOSES")}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
            mode === "CLIENT_CHOOSES" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          El cliente elige
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => choose("BUSINESS_ASSIGNS")}
          className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${
            mode === "BUSINESS_ASSIGNS" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Nosotros asignamos
        </button>
      </div>
      <p className="text-xs text-muted-foreground max-w-sm">
        {mode === "CLIENT_CHOOSES"
          ? "El cliente elige el especialista al reservar, como hasta ahora."
          : "El cliente solo elige servicio y horario — tú repartes cada cita entre los especialistas disponibles desde la Agenda."}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
