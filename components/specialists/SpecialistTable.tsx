"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteSpecialist, toggleSpecialistActive, type SpecialistListItem } from "@/lib/actions/specialists";

export function SpecialistTable({ specialists }: { specialists: SpecialistListItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleSpecialistActive(id, !active);
      router.refresh();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSpecialist(id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (specialists.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aún no tienes especialistas registrados.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Servicios</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {specialists.map((s) => (
              <tr key={s.id} className={`border-b border-border last:border-0 ${!s.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 font-medium">{s.displayName}</td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                  {s.serviceIds.length} servicio{s.serviceIds.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-2">{s.active ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <Link href={`/specialists/${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Editar
                    </Link>
                    <Button
                      size="sm"
                      variant={s.active ? "destructive" : "secondary"}
                      disabled={isPending}
                      onClick={() => toggle(s.id, s.active)}
                    >
                      {s.active ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => handleDelete(s.id, s.displayName)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
