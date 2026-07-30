"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateExchangeRate } from "@/lib/actions/business";
import { getCurrency } from "@/lib/currencies";

export function ExchangeRateForm({
  currentRate,
  currencyCode,
  foreignCurrencyCode,
}: {
  currentRate: number | null;
  currencyCode: string;
  foreignCurrencyCode: string;
}) {
  const currencyName = getCurrency(currencyCode).name.split(" (")[0];
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateExchangeRate(formData);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rate">
          {currencyName} por 1 {foreignCurrencyCode}
        </Label>
        <Input
          id="rate"
          name="rate"
          type="number"
          min={0}
          step="0.0001"
          defaultValue={currentRate ?? ""}
          placeholder="Ej. 45.0000"
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Actualizar tasa"}
      </Button>
    </form>
  );
}
