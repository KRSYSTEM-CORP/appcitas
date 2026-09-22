"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queueAppointment, type PendingAppointmentInput } from "@/lib/offline/sync";
import { formatDuration, formatMoney } from "@/lib/format";
import { serviceLocalPriceCents } from "@/lib/pricing";
import { todayDateKey, zonedTimeToUtc } from "@/lib/timezone";
import type { AgendaSnapshot } from "@/lib/offline/db";

const UNASSIGNED = "";

// Creates a queued walk-in appointment while offline. Deliberately simpler
// than the real Nueva Cita form (components/agenda/AppointmentForm.tsx):
// the client is always typed by hand (no search/picker, same choice already
// made for KR POS's offline CustomerForm), and the time is typed by hand too
// — there's no live getAvailableSlotsForStaff to call without a network, and
// rebuilding its business-hours/free-slot logic offline is a meaningfully
// bigger, unrequested undertaking. The real, authoritative conflict check
// still happens server-side inside createAppointment when this syncs (see
// lib/offline/sync.ts) — a genuine double-booking gets blocked there and
// surfaces in the owner's review screen, never silently overwritten.
export function AppointmentFormOffline({ snapshot }: { snapshot: AgendaSnapshot }) {
  const [specialistId, setSpecialistId] = useState(UNASSIGNED);
  const [serviceId, setServiceId] = useState("");
  const [dateKey, setDateKey] = useState(todayDateKey());
  const [time, setTime] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [isPending, startTransition] = useTransition();

  const availableServices = useMemo(() => {
    if (!specialistId) return snapshot.services;
    const specialist = snapshot.specialists.find((s) => s.id === specialistId);
    if (!specialist) return [];
    return snapshot.services.filter((s) => specialist.serviceIds.includes(s.id));
  }, [snapshot, specialistId]);

  const selectedService = availableServices.find((s) => s.id === serviceId);

  // Soft, non-authoritative hint only — compares the typed time against
  // appointments already in the cached snapshot for the chosen specialist.
  // Never blocks submit: the snapshot can be stale (another terminal may
  // have booked something since it was saved), and the real check happens
  // server-side at sync time regardless.
  const overlapWarning = useMemo(() => {
    if (!specialistId || !selectedService || !dateKey || !time) return null;
    const startsAt = zonedTimeToUtc(dateKey, time);
    if (Number.isNaN(startsAt.getTime())) return null;
    const endsAt = new Date(startsAt.getTime() + selectedService.durationMinutes * 60_000);
    const conflict = snapshot.todayAppointments.find((a) => {
      if (a.specialistId !== specialistId) return false;
      if (a.status === "CANCELLED" || a.status === "NO_SHOW") return false;
      const existingStart = new Date(a.startsAt);
      const existingEnd = new Date(a.endsAt);
      return startsAt < existingEnd && endsAt > existingStart;
    });
    return conflict
      ? `Ya hay una cita con este especialista a esa hora, según los datos guardados (puede estar desactualizado).`
      : null;
  }, [snapshot, specialistId, selectedService, dateKey, time]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQueued(false);

    if (!serviceId) {
      setError("Elige un servicio");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setError("Escribe una hora válida");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setError("Nombre, apellido y teléfono del cliente son obligatorios");
      return;
    }

    const specialist = snapshot.specialists.find((s) => s.id === specialistId);
    const service = snapshot.services.find((s) => s.id === serviceId);

    const input: PendingAppointmentInput = {
      newClient: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() },
      specialistId: specialistId || undefined,
      serviceId,
      dateKey,
      time,
      notes: notes.trim() || undefined,
    };

    startTransition(async () => {
      await queueAppointment(input, {
        clientName: `${firstName.trim()} ${lastName.trim()}`,
        clientPhone: phone.trim(),
        serviceName: service?.name ?? "",
        specialistName: specialist?.displayName ?? null,
        dateKey,
        time,
      });
      setQueued(true);
      setFirstName("");
      setLastName("");
      setPhone("");
      setNotes("");
      setTime("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-2">
        Sin conexión: la hora no se valida contra el horario del negocio en este momento. Si al
        reconectar el especialista ya tenía esa hora ocupada, la cita quedará pendiente de revisión
        en vez de agendarse dos veces.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-specialist">Especialista</Label>
          <select
            id="offline-specialist"
            value={specialistId}
            onChange={(e) => {
              setSpecialistId(e.target.value);
              setServiceId("");
            }}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={UNASSIGNED}>Sin asignar (elegir después)</option>
            {snapshot.specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-service">Servicio</Label>
          <select
            id="offline-service"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">
              {availableServices.length === 0 ? "Este especialista no tiene servicios asignados" : "Elige un servicio"}
            </option>
            {availableServices.map((s) => {
              const localCents = serviceLocalPriceCents(s, { localCurrencyCode: snapshot.localCurrencyCode }, snapshot.rate);
              const priceLabel =
                localCents != null && s.priceCurrencyCode !== snapshot.localCurrencyCode
                  ? `${formatMoney(s.basePriceCents, s.priceCurrencyCode)} (≈ ${formatMoney(localCents, snapshot.localCurrencyCode)})`
                  : formatMoney(s.basePriceCents, s.priceCurrencyCode);
              return (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMinutes)} · {priceLabel}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-date">Fecha</Label>
          <Input id="offline-date" type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-time">Hora</Label>
          <Input id="offline-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
      </div>

      {overlapWarning && <p className="text-sm text-warning">{overlapWarning}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-firstName">Nombre</Label>
          <Input id="offline-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-lastName">Apellido</Label>
          <Input id="offline-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="offline-phone">Teléfono</Label>
          <Input id="offline-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="offline-notes">Notas (opcional)</Label>
        <textarea
          id="offline-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {queued && (
        <p className="text-sm text-success">
          Cita guardada en este dispositivo — se agendará sola apenas vuelva la conexión.
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar cita sin conexión"}
      </Button>
    </form>
  );
}
