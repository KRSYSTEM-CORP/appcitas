"use client";

import { useAgendaSync } from "@/lib/offline/use-agenda-sync";
import type { AgendaSnapshotAppointment } from "@/lib/offline/db";
import type { SpecialistListItem } from "@/lib/actions/specialists";
import type { ServiceListItem } from "@/lib/actions/services";
import type { AppointmentListItem } from "@/lib/actions/appointments";

// Renders nothing — keeps IndexedDB's offline agenda snapshot warm for this
// business, same "invisible client component embedded in the server page"
// idiom as AgendaLiveRefresh. Converts the server's Date-carrying
// AppointmentListItem rows into the snapshot's plain ISO-string shape here
// (not in app/(app)/agenda/page.tsx) so the server page stays focused on
// fetching, not on IndexedDB's storage format.
export function AgendaSnapshotSync({
  businessId,
  businessName,
  specialists,
  services,
  todayAppointments,
  localCurrencyCode,
  fxEnabled,
  foreignCurrencyCode,
  rate,
}: {
  businessId: string;
  businessName: string;
  specialists: SpecialistListItem[];
  services: ServiceListItem[];
  todayAppointments: AppointmentListItem[];
  localCurrencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  rate: number | null;
}) {
  const snapshotAppointments: AgendaSnapshotAppointment[] = todayAppointments.map((a) => ({
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    clientFirstName: a.client.firstName,
    clientLastName: a.client.lastName,
    clientPhone: a.client.phone,
    specialistId: a.specialist?.id ?? null,
    specialistName: a.specialist?.displayName ?? null,
    serviceName: a.service.name,
  }));

  useAgendaSync({
    businessId,
    businessName,
    specialists,
    services,
    todayAppointments: snapshotAppointments,
    localCurrencyCode,
    fxEnabled,
    foreignCurrencyCode,
    rate,
  });

  return null;
}
