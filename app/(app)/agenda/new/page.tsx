import { AppointmentForm } from "@/components/agenda/AppointmentForm";
import { listActiveSpecialists } from "@/lib/actions/specialists";
import { listActiveServices } from "@/lib/actions/services";
import { listClients } from "@/lib/actions/clients";
import { getFxInfo } from "@/lib/actions/business";
import { toDateKey } from "@/lib/format";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const [specialists, services, clients, fx] = await Promise.all([
    listActiveSpecialists(),
    listActiveServices(),
    listClients(),
    getFxInfo(),
  ]);

  return (
    <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Nueva cita</h1>
      </div>
      {specialists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Necesitas al menos un especialista activo con servicios asignados antes de poder agendar.
        </p>
      ) : (
        <AppointmentForm
          specialists={specialists}
          services={services}
          clients={clients}
          currencyCode={fx.localCurrencyCode}
          rate={fx.rate}
          defaultDateKey={date ?? toDateKey(new Date())}
        />
      )}
    </div>
  );
}
