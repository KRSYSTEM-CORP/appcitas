import { PackageForm } from "@/components/packages/PackageForm";
import { listActiveSpecialists } from "@/lib/actions/specialists";
import { listActiveServices } from "@/lib/actions/services";
import { listClients } from "@/lib/actions/clients";
import { getFxInfo } from "@/lib/actions/business";
import { todayDateKey } from "@/lib/timezone";

export default async function NewPackagePage() {
  const [specialists, services, clients, fx] = await Promise.all([
    listActiveSpecialists(),
    listActiveServices(),
    listClients(),
    getFxInfo(),
  ]);

  return (
    <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo paquete de sesiones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Agenda varias citas del mismo cliente de una vez — ideal para fisioterapia, tratamientos de belleza u otros
          planes de varias sesiones.
        </p>
      </div>
      {specialists.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Necesitas al menos un especialista activo con servicios asignados antes de poder crear un paquete.
        </p>
      ) : (
        <PackageForm
          specialists={specialists}
          services={services}
          clients={clients}
          currencyCode={fx.localCurrencyCode}
          rate={fx.rate}
          defaultDateKey={todayDateKey()}
        />
      )}
    </div>
  );
}
