"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAppointment, getAvailableSlotsForStaff } from "@/lib/actions/appointments";
import { formatDuration, formatMoney } from "@/lib/format";
import { serviceLocalPriceCents } from "@/lib/pricing";
import type { SpecialistListItem } from "@/lib/actions/specialists";
import type { ServiceListItem } from "@/lib/actions/services";
import type { ClientListItem } from "@/lib/actions/clients";

const NEW_CLIENT = "__new__";

// Pure "HH:mm" string arithmetic, deliberately not a Date object — the slot
// itself is already a Caracas wall-clock reading (see getAvailableSlots), so
// adding a duration to it needs no timezone conversion at all, just minutes.
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function AppointmentForm({
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
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingSlots, startSlotsTransition] = useTransition();

  const availableServices = useMemo(() => {
    // "Sin asignar" — staff hasn't picked a specialist yet, so any service
    // is fair game; getAvailableSlotsForStaff below falls back to combined
    // availability across whoever can actually perform it.
    if (!specialistId) return services;
    const specialist = specialists.find((s) => s.id === specialistId);
    if (!specialist) return [];
    return services.filter((s) => specialist.serviceIds.includes(s.id));
  }, [specialists, services, specialistId]);

  const selectedService = availableServices.find((s) => s.id === serviceId);

  // Same free/busy source the public booking link uses (getAvailableSlots),
  // just wrapped with the signed-in session's own businessId instead of a
  // client-supplied one — staff sees exactly the same "only what's actually
  // open" picker a client would, instead of a free-text time field that let
  // double-bookings or off-hours times through until submit.
  useEffect(() => {
    setTime(null);
    if (!serviceId || !dateKey) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    startSlotsTransition(async () => {
      const result = await getAvailableSlotsForStaff(specialistId || undefined, serviceId, dateKey);
      if (!cancelled) setSlots(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialistId, serviceId, dateKey]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!serviceId) {
      setError("Elige un servicio");
      return;
    }
    if (!time) {
      setError("Elige un horario disponible");
      return;
    }
    if (clientChoice === NEW_CLIENT && (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim())) {
      setError("Nombre, apellido y teléfono del cliente son obligatorios");
      return;
    }

    startTransition(async () => {
      const result = await createAppointment({
        clientId: clientChoice === NEW_CLIENT ? undefined : clientChoice,
        newClient:
          clientChoice === NEW_CLIENT
            ? { firstName: newFirstName, lastName: newLastName, phone: newPhone }
            : undefined,
        specialistId: specialistId || undefined,
        serviceId,
        dateKey,
        time,
        notes,
      });
      if (result.success) {
        router.push(`/agenda?date=${dateKey}`);
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
          {specialists.length === 0 ? (
            <option value="">No hay especialistas activos</option>
          ) : (
            <option value="">Sin asignar (elegir después)</option>
          )}
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
        {selectedService && time && (
          <p className="text-xs text-muted-foreground">Termina a las {addMinutesToTime(time, selectedService.durationMinutes)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateKey">Fecha</Label>
        <Input id="dateKey" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} required />
      </div>

      {serviceId && dateKey && (
        <div className="flex flex-col gap-1.5">
          <Label>Horario disponible</Label>
          {loadingSlots ? (
            <p className="text-sm text-muted-foreground">Buscando horarios...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay horarios disponibles ese día. Prueba otra fecha.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTime(s)}
                  className={`rounded-md border px-3 py-1.5 text-sm tabular-nums transition-colors ${
                    time === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
        {isPending ? "Agendando..." : "Agendar cita"}
      </Button>
    </form>
  );
}
