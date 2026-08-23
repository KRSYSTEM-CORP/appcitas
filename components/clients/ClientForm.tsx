"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/types";
import type { ClientListItem } from "@/lib/actions/clients";

export function ClientForm({
  client,
  action,
}: {
  client?: ClientListItem;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.success) {
        if (client) {
          router.push("/clients");
        } else {
          formRef.current?.reset();
        }
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 max-w-4xl rounded-lg border border-border p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" name="firstName" defaultValue={client?.firstName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">Apellido</Label>
          <Input id="lastName" name="lastName" defaultValue={client?.lastName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={client?.phone} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo (opcional)</Label>
          <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={client?.notes ?? ""}
          rows={2}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Guardando..." : client ? "Guardar cambios" : "Agregar cliente"}
      </Button>
    </form>
  );
}
