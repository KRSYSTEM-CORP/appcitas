"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClient } from "@/lib/actions/clients";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`¿Eliminar a ${clientName}? Dejará de aparecer en tu lista de clientes, pero su historial de citas y pagos se conserva.`))
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteClient(clientId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs text-destructive underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
      >
        {isPending ? "Eliminando..." : "Eliminar"}
      </button>
      {error && <p className="text-xs text-destructive text-right max-w-[180px]">{error}</p>}
    </div>
  );
}
