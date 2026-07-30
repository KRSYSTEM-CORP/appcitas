"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateLocalCurrency } from "@/lib/actions/business";
import { CURRENCIES } from "@/lib/currencies";

export function CurrencySelectForm({
  currentCurrencyCode,
  referenceCurrency,
}: {
  currentCurrencyCode: string;
  referenceCurrency: string;
}) {
  const router = useRouter();
  const [currencyCode, setCurrencyCode] = useState(currentCurrencyCode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("localCurrencyCode", currencyCode);
      const result = await updateLocalCurrency(formData);
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
        <Label htmlFor="currency">Moneda local de tu país</Label>
        <select
          id="currency"
          value={currencyCode}
          onChange={(e) => setCurrencyCode(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.symbol})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Los precios se guardan internamente en {referenceCurrency} y se muestran convertidos a esta moneda usando
          tu tasa de cambio.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-muted-foreground">Guardado.</p>}

      <Button type="submit" disabled={isPending || currencyCode === currentCurrencyCode}>
        {isPending ? "Guardando..." : "Guardar moneda"}
      </Button>
    </form>
  );
}
