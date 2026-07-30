"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPackage } from "@/lib/actions/packages";
import { formatDuration, formatMoney } from "@/lib/format";
import { serviceLocalPriceCents } from "@/lib/pricing";
import type { SpecialistListItem } from "@/lib/actions/specialists";
import type { ServiceListItem } from "@/lib/actions/services";
import type { ClientListItem } from "@/lib/actions/clients";
import type { PackagePaymentMode } from "@prisma/client";

const NEW_CLIENT = "__new__";

export function PackageForm({
  specialists,
  services,
  clients,
  currencyCode,
  rate,
  defaultDateKey,
}: {
  specialists: SpecialistListItem[];
  services: ServiceListItem[];
  clients: ClientListItem[];
  currencyCode: string;
  rate: number | null;
  defaultDateKey: string;
}) {
  const router = useRouter();
  const [specialistId, setSpecialistId] = useState(specialists[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [clientChoice, setClientChoice] = useState(clients[0]?.id ?? NEW_CLIENT);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [dateKey, setDateKey] = useState(defaultDateKey);
  const [time, setTime] = useState("09:00");
  const [totalSessions, setTotalSessions] = useState("6");
  const [intervalDays, setIntervalDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<PackagePaymentMode>("PER_SESSION");
  const [packagePrice, setPackagePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableServices = useMemo(() => {
    const specialist = specialists.find((s) => s.id === specialistId);
    if (!specialist) return [];
    return services.filter((s) => specialist.serviceIds.includes(s.id));
  }, [specialists, services, specialistId]);

  const selectedService = availableServices.find((s) => s.id === serviceId);
  const suggestedTotal =
    selectedService && Number(totalSessions) > 0
      ? Math.round(selectedService.basePriceCents * Number(totalSessions)) / 100
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!serviceId) {
      setError("Elige un servicio");
      return;
    }
    if (clientChoice === NEW_CLIENT && (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim())) {
      setError("Nombre, apellido y teléfono del cliente son obligatorios");
      return;
    }
    if (paymentMode === "PACKAGE" && (!packagePrice || Number(packagePrice) <= 0)) {
      setError("Indica el precio total del paquete");
      return;
    }

    startTransition(async () => {
      const result = await createPackage({
        clientId: clientChoice === NEW_CLIENT ? undefined : clientChoice,
        newClient:
          clientChoice === NEW_CLIENT
            ? { firstName: newFirstName, lastName: newLastName, phone: newPhone }
            : undefined,
        specialistId,
        serviceId,
        totalSessions: Number(totalSessions),
        intervalDays: Number(intervalDays),
        dateKey,
        time,
        notes,
        paymentMode,
        packagePrice: paymentMode === "PACKAGE" ? Number(packagePrice) : undefined,
        packagePriceCurrencyCode: paymentMode === "PACKAGE" ? selectedService?.priceCurrencyCode : undefined,
      });
      if (result.success) {
        router.push("/packages");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="specialistId">Especialista</Label>
        <select
          id="specialistId"
          value={specialistId}
          onChange={(e) => {
            setSpecialistId(e.target.value);
            setServiceId("");
          }}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {specialists.length === 0 && <option value="">No hay especialistas activos</option>}
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="serviceId">Servicio</Label>
        <select
          id="serviceId"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">
            {availableServices.length === 0 ? "Este especialista no tiene servicios asignados" : "Elige un servicio"}
          </option>
          {availableServices.map((s) => {
            const localCents = serviceLocalPriceCents(s, { localCurrencyCode: currencyCode }, rate);
            const priceLabel =
              localCents != null && s.priceCurrencyCode !== currencyCode
                ? `${formatMoney(s.basePriceCents, s.priceCurrencyCode)} (≈ ${formatMoney(localCents, currencyCode)})`
                : formatMoney(s.basePriceCents, s.priceCurrencyCode);
            return (
              <option key={s.id} value={s.id}>
                {s.name} · {formatDuration(s.durationMinutes)} · {priceLabel}
              </option>
            );
          })}
        </select>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="dateKey">Primera sesión</Label>
          <Input id="dateKey" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="time">Hora</Label>
          <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="totalSessions">Número de sesiones</Label>
          <Input
            id="totalSessions"
            type="number"
            min="2"
            max="52"
            value={totalSessions}
            onChange={(e) => setTotalSessions(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1">
          <Label htmlFor="intervalDays">Cada cuántos días</Label>
          <Input
            id="intervalDays"
            type="number"
            min="1"
            max="90"
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Se crearán {totalSessions || 0} citas, una cada {intervalDays || 0} día(s), a la misma hora.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientChoice">Cliente</Label>
        <select
          id="clientChoice"
          value={clientChoice}
          onChange={(e) => setClientChoice(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value={NEW_CLIENT}>+ Nuevo cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName} · {c.phone}
            </option>
          ))}
        </select>
      </div>

      {clientChoice === NEW_CLIENT && (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label htmlFor="newFirstName">Nombre</Label>
            <Input id="newFirstName" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label htmlFor="newLastName">Apellido</Label>
            <Input id="newLastName" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label htmlFor="newPhone">Teléfono</Label>
            <Input id="newPhone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Forma de pago del paquete</Label>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="paymentMode"
              checked={paymentMode === "PER_SESSION"}
              onChange={() => setPaymentMode("PER_SESSION")}
              className="mt-0.5"
            />
            <span>
              Pago por sesión — el cliente paga cada cita que asista, igual que una cita normal.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="paymentMode"
              checked={paymentMode === "PACKAGE"}
              onChange={() => setPaymentMode("PACKAGE")}
              className="mt-0.5"
            />
            <span>Un solo pago por todo el paquete, sin importar cuántas sesiones asista.</span>
          </label>
        </div>
      </div>

      {paymentMode === "PACKAGE" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="packagePrice">
            Precio total del paquete {selectedService && `(${selectedService.priceCurrencyCode})`}
          </Label>
          <Input
            id="packagePrice"
            type="number"
            min="0"
            step="0.01"
            value={packagePrice}
            onChange={(e) => setPackagePrice(e.target.value)}
            placeholder={suggestedTotal != null ? suggestedTotal.toFixed(2) : undefined}
            required
          />
          {suggestedTotal != null && (
            <p className="text-xs text-muted-foreground">
              Precio del servicio × sesiones: {formatMoney(Math.round(suggestedTotal * 100), selectedService!.priceCurrencyCode)}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending || specialists.length === 0}>
        {isPending ? "Creando paquete..." : "Crear paquete"}
      </Button>
    </form>
  );
}
