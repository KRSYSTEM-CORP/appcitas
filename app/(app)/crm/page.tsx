import { CrmTable } from "@/components/crm/CrmTable";
import { listClientsForCrm } from "@/lib/actions/clients";
import { getBusinessConfig } from "@/lib/actions/business";
import { requireOwner } from "@/lib/session";

export default async function CrmPage() {
  await requireOwner();
  const [clients, business] = await Promise.all([listClientsForCrm(), getBusinessConfig()]);

  const withVisit = clients.filter((c) => c.lastVisit !== null).length;

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cuándo asistió cada clienta por última vez, para saber a quién contactar y ofrecerle tus servicios de
          nuevo.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        {clients.length} cliente{clients.length === 1 ? "" : "s"} · {withVisit} con al menos una visita registrada
      </p>

      <CrmTable clients={clients} businessName={business.name} bookingPath={`/book/${business.subdomain}`} />
    </div>
  );
}
