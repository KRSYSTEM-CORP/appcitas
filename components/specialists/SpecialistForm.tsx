"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/types";
import type { SpecialistListItem } from "@/lib/actions/specialists";
import type { ServiceListItem } from "@/lib/actions/services";

export function SpecialistForm({
  specialist,
  services,
  action,
}: {
  specialist?: SpecialistListItem;
  services: ServiceListItem[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(specialist?.serviceIds ?? []));
  const [isPending, startTransition] = useTransition();

  function toggleService(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    for (const id of selected) formData.append("serviceIds", id);
    startTransition(async () => {
      const result = await action(formData);
      if (result.success) {
        router.push("/specialists");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Nombre</Label>
        <Input id="displayName" name="displayName" defaultValue={specialist?.displayName} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bio">Descripción (opcional)</Label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={specialist?.bio ?? ""}
          rows={2}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Servicios que puede realizar</Label>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no tienes servicios activos. Crea uno primero en Servicios.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleService(s.id)} />
                {s.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : specialist ? "Guardar cambios" : "Crear especialista"}
      </Button>
    </form>
  );
}
