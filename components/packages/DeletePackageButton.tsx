"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePackage } from "@/lib/actions/packages";

export function DeletePackageButton({ packageId, clientName }: { packageId: string; clientName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el paquete de ${clientName}? Esta acción no se puede deshacer.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePackage(packageId);
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
