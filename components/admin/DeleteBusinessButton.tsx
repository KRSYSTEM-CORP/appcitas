"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteBusiness } from "@/lib/actions/admin";

// Permanently deletes a whole tenant's data (appointments, payments,
// clients, staff, services) — a plain confirm() is too weak for something
// this destructive, so this requires typing the exact business name before
// the delete button even becomes clickable, same spirit as GitHub's
// repo-delete flow.
export function DeleteBusinessButton({ businessId, businessName }: { businessId: string; businessName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBusiness(businessId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Eliminar
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 max-w-[220px]">
      <p className="text-xs text-destructive text-right">
        Esto borra permanentemente todo el historial de &quot;{businessName}&quot;. Escribe el nombre exacto para
        confirmar.
      </p>
      <Input
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        placeholder={businessName}
        className="h-8 text-xs"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setConfirming(false);
            setTypedName("");
            setError(null);
          }}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending || typedName !== businessName}
          onClick={handleDelete}
        >
          {isPending ? "Eliminando..." : "Eliminar definitivamente"}
        </Button>
      </div>
    </div>
  );
}
