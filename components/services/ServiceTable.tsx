"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { deleteService, toggleServiceActive, type ServiceListItem } from "@/lib/actions/services";
import { formatDuration, formatMoney } from "@/lib/format";
import { serviceLocalPriceCents } from "@/lib/pricing";

export function ServiceTable({
  services,
  currencyCode,
  rate,
}: {
  services: ServiceListItem[];
  currencyCode: string;
  rate: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string, active: boolean) {
    startTransition(async () => {
      await toggleServiceActive(id, !active);
      router.refresh();
    });
  }

  function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `¿Eliminar el servicio "${name}"? Esto también elimina permanentemente sus citas, paquetes y pagos asociados. Para conservar el historial, usa "Desactivar" en su lugar.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteService(id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aún no tienes servicios registrados.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Servicio</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Duración</th>
              <th className="px-4 py-2 font-medium">Precio</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className={`border-b border-border last:border-0 ${!s.active ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.category ?? "—"}</td>
                <td className="px-4 py-2 tabular-nums">{formatDuration(s.durationMinutes)}</td>
                <td className="px-4 py-2 tabular-nums">
                  {formatMoney(s.basePriceCents, s.priceCurrencyCode)}
                  {s.priceCurrencyCode !== currencyCode &&
                    (() => {
                      const localCents = serviceLocalPriceCents(s, { localCurrencyCode: currencyCode }, rate);
                      return localCents != null ? (
                        <span className="text-muted-foreground"> (≈ {formatMoney(localCents, currencyCode)})</span>
                      ) : null;
                    })()}
                </td>
                <td className="px-4 py-2">{s.active ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <Link href={`/services/${s.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
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
                    <Button size="sm" variant="ghost" disabled={isPending} onClick={() => handleDelete(s.id, s.name)}>
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
