import { PendingAppointmentReview } from "@/components/agenda/PendingAppointmentReview";
import { requireOwner } from "@/lib/session";

// Owner-only — a queued offline appointment's IndexedDB queue lives entirely
// in THIS browser/device, so there's nothing per-business/server-side to
// guard beyond "is this person allowed to configure the business" (same
// gate as Clientes/Servicios/Especialistas). No offline fallback for this
// page on purpose: reviewing/discarding a blocked appointment is a
// deliberate, online, owner action, not something that needs to work
// mid-outage.
export default async function AgendaReviewPage() {
  await requireOwner();

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Citas pendientes de revisión</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Citas hechas sin conexión que no se pudieron sincronizar automáticamente — por ejemplo,
          porque el especialista ya tenía esa hora ocupada cuando volvió la conexión. Revísalas y
          decide si reintentar (tras reasignar o ajustar) o descartar.
        </p>
      </div>
      <PendingAppointmentReview />
    </div>
  );
}
