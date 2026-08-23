"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/types";
import type { ServiceListItem } from "@/lib/actions/services";

export function ServiceForm({
  service,
  currencyOptions,
  action,
}: {
  service?: ServiceListItem;
  currencyOptions: string[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [priceCurrencyCode, setPriceCurrencyCode] = useState(
    service?.priceCurrencyCode ?? currencyOptions[0],
  );
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result.success) {
        router.push("/services");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 max-w-4xl rounded-lg border border-border p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nombre del servicio</Label>
          <Input id="name" name="name" defaultValue={service?.name} placeholder="Corte de cabello" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Categoría (opcional)</Label>
          <Input id="category" name="category" defaultValue={service?.category ?? ""} placeholder="Cabello" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">Duración (min)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={service?.durationMinutes ?? 30}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="basePrice">Precio ({priceCurrencyCode})</Label>
          <div className="flex gap-2">
            <Input
              id="basePrice"
              name="basePrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={service ? (service.basePriceCents / 100).toFixed(2) : undefined}
              required
              className="flex-1"
            />
            {currencyOptions.length > 1 && (
              <select
                name="priceCurrencyCode"
                value={priceCurrencyCode}
                onChange={(e) => setPriceCurrencyCode(e.target.value)}
                className="h-10 rounded-md border border-input bg-card px-2 text-sm"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            {currencyOptions.length <= 1 && (
              <input type="hidden" name="priceCurrencyCode" value={priceCurrencyCode} />
            )}
          </div>
        </div>
      </div>
      {currencyOptions.length > 1 && (
        <p className="text-xs text-muted-foreground -mt-2">
          El precio se guarda en {priceCurrencyCode} y se convierte a la moneda local con la tasa
          vigente al mostrarlo o cobrarlo.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={service?.description ?? ""}
          rows={3}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : service ? "Guardar cambios" : "Crear servicio"}
      </Button>
    </form>
  );
}
