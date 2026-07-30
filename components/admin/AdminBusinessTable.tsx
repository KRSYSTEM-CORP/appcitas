"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveBusiness,
  denyBusiness,
  suspendBusiness,
  reactivateBusiness,
  type AdminBusinessRow,
} from "@/lib/actions/admin";
import { DeleteBusinessButton } from "@/components/admin/DeleteBusinessButton";
import { formatDate } from "@/lib/format";

const STATUS_LABELS = { PENDING: "Pendiente", ACTIVE: "Activo", SUSPENDED: "Suspendido" } as const;
const STATUS_STYLES = {
  PENDING: "bg-warning/15 text-warning",
  ACTIVE: "bg-success/15 text-success",
  SUSPENDED: "bg-destructive/10 text-destructive",
} as const;

export function AdminBusinessTable({ businesses }: { businesses: AdminBusinessRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (businesses.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No hay negocios registrados todavía.</p>;
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Negocio</th>
            <th className="px-4 py-2 font-medium">Correo</th>
            <th className="px-4 py-2 font-medium">Registrado</th>
            <th className="px-4 py-2 font-medium">Estado</th>
            <th className="px-4 py-2 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <tr key={b.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{b.name}</td>
              <td className="px-4 py-2 text-muted-foreground">{b.ownerEmail}</td>
              <td className="px-4 py-2 text-muted-foreground">{formatDate(b.createdAt)}</td>
              <td className="px-4 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[b.ownerStatus]}`}>
                  {STATUS_LABELS[b.ownerStatus]}
                </span>
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-col items-end gap-2">
                  <div className="flex justify-end gap-2">
                    {b.ownerStatus === "PENDING" && (
                      <>
                        <Button size="sm" disabled={isPending} onClick={() => run(() => approveBusiness(b.ownerId))}>
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => run(() => denyBusiness(b.ownerId))}
                        >
                          Denegar
                        </Button>
                      </>
                    )}
                    {b.ownerStatus === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => run(() => suspendBusiness(b.ownerId))}
                      >
                        Suspender
                      </Button>
                    )}
                    {b.ownerStatus === "SUSPENDED" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => run(() => reactivateBusiness(b.ownerId))}
                      >
                        Reactivar
                      </Button>
                    )}
                  </div>
                  <DeleteBusinessButton businessId={b.id} businessName={b.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
