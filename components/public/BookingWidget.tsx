"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAvailableSlots, getAvailableSlotsAnySpecialist, createPublicAppointment } from "@/lib/actions/public";
import { formatDuration, formatMoney } from "@/lib/format";
import { todayDateKey } from "@/lib/timezone";
import { serviceLocalPriceCents } from "@/lib/pricing";
import type { PublicService, PublicSpecialist } from "@/lib/actions/public";
import type { SpecialistAssignmentMode } from "@prisma/client";

function todayKey() {
  return todayDateKey();
}

export function BookingWidget({
  subdomain,
  businessId,
  services,
  specialists,
  currencyCode,
  rate,
  specialistAssignmentMode,
}: {
  subdomain: string;
  businessId: string;
  services: PublicService[];
  specialists: PublicSpecialist[];
  currencyCode: string;
  rate: number | null;
  specialistAssignmentMode: SpecialistAssignmentMode;
}) {
  const businessAssigns = specialistAssignmentMode === "BUSINESS_ASSIGNS";
  const [serviceId, setServiceId] = useState("");
  const [specialistId, setSpecialistId] = useState("");
  const [dateKey, setDateKey] = useState(todayKey());
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelToken, setCancelToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingSlots, startSlotsTransition] = useTransition();

  const availableSpecialists = useMemo(
    () => specialists.filter((s) => !serviceId || s.serviceIds.includes(serviceId)),
    [specialists, serviceId],
  );

  useEffect(() => {
    // Nothing to fetch yet — the JSX below only renders the slots section
    // once dateKey (and, when the client picks their own specialist,
    // specialistId) are set, so leaving stale `slots` alone here is fine
    // (it can't be shown).
    if (!serviceId || !dateKey) return;
    if (!businessAssigns && !specialistId) return;

    let cancelled = false;
    startSlotsTransition(async () => {
      const result = businessAssigns
        ? await getAvailableSlotsAnySpecialist(businessId, serviceId, dateKey)
        : await getAvailableSlots(businessId, specialistId, serviceId, dateKey);
      if (!cancelled) setSlots(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId, specialistId, dateKey, businessAssigns]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!time) {
      setError("Elige un horario disponible");
      return;
    }
    startTransition(async () => {
      const result = await createPublicAppointment({
        subdomain,
        specialistId: businessAssigns ? undefined : specialistId,
        serviceId,
        dateKey,
        time,
        client: { firstName, lastName, phone, email: email || undefined },
      });
      if (result.success) {
        setCancelToken(result.cancelToken);
      } else {
        setError(result.error);
      }
    });
  }

  if (cancelToken) {
    const cancelUrl = typeof window !== "undefined" ? `${window.location.origin}/cancel/${cancelToken}` : "";
    return (
      <div className="flex flex-col gap-2 items-center text-center py-12">
        <h2 className="text-xl font-semibold">¡Cita solicitada!</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Tu cita quedó registrada como pendiente de confirmación. El negocio se pondrá en contacto contigo.
        </p>
        {cancelUrl && (
          <p className="text-xs text-muted-foreground max-w-sm mt-2">
            Si necesitas cancelarla más adelante, guarda este enlace:{" "}
            <a href={cancelUrl} className="underline underline-offset-2">
              {cancelUrl}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-md mx-auto">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="serviceId">Servicio</Label>
        <select
          id="serviceId"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            setSpecialistId("");
            setTime(null);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          required
        >
          <option value="">Elige un servicio</option>
          {services.map((s) => {
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

      {serviceId && !businessAssigns && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="specialistId">Especialista</Label>
          <select
            id="specialistId"
            value={specialistId}
            onChange={(e) => {
              setSpecialistId(e.target.value);
              setTime(null);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          >
            <option value="">
              {availableSpecialists.length === 0 ? "Nadie ofrece este servicio ahora mismo" : "Elige un especialista"}
            </option>
            {availableSpecialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {serviceId && (businessAssigns || specialistId) && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateKey">Fecha</Label>
          <Input
            id="dateKey"
            type="date"
            min={todayKey()}
            value={dateKey}
            onChange={(e) => {
              setDateKey(e.target.value);
              setTime(null);
            }}
            required
          />
        </div>
      )}

      {serviceId && (businessAssigns || specialistId) && dateKey && (
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
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {time && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="firstName">Nombre</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo (opcional)</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={isPending} size="lg">
            {isPending ? "Agendando..." : "Confirmar cita"}
          </Button>
        </div>
      )}
    </form>
  );
}
