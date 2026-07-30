"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateReferenceCurrencySettings } from "@/lib/actions/business";

export function ReferenceCurrencyForm({
  currentEnabled,
  currentReferenceCurrency,
}: {
  currentEnabled: boolean;
  currentReferenceCurrency: string;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(currentEnabled);
  const [referenceCurrency, setReferenceCurrency] = useState(currentReferenceCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = enabled !== currentEnabled || referenceCurrency !== currentReferenceCurrency;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateReferenceCurrencySettings({ fxEnabled: enabled, foreignCurrencyCode: referenceCurrency });
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <Label>¿Activar tasa de cambio para tus servicios?</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={enabled ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setEnabled(true);
              setSaved(false);
            }}
          >
            Activada
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!enabled ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setEnabled(false);
              setSaved(false);
            }}
          >
            Desactivada
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Tus precios se muestran en tu moneda local, convertidos con la tasa de cambio, junto al precio de referencia."
            : "Tus precios se mostrarán en una sola moneda (la de referencia, abajo) — sin conversión ni tasa de cambio."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Moneda de referencia</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={referenceCurrency === "EUR" ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setReferenceCurrency("EUR");
              setSaved(false);
            }}
          >
            EUR (Euro)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={referenceCurrency === "USD" ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setReferenceCurrency("USD");
              setSaved(false);
            }}
          >
            USD (Dólar)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Todos tus servicios se guardan y calculan internamente en esta moneda de referencia.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-muted-foreground">Guardado.</p>}

      <Button type="submit" disabled={isPending || !dirty} className="self-start">
        {isPending ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
