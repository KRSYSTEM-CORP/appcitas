import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/services/ServiceForm";
import { ServiceHoursForm } from "@/components/services/ServiceHoursForm";
import { getService, getServiceHours, updateService } from "@/lib/actions/services";
import { getFxInfo } from "@/lib/actions/business";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [service, fx, serviceHours] = await Promise.all([getService(id), getFxInfo(), getServiceHours(id)]);
  if (!service || !serviceHours) notFound();
  const currencyOptions = fx.fxEnabled ? [fx.foreignCurrencyCode, fx.localCurrencyCode] : [fx.localCurrencyCode];

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">Editar servicio</h1>
      </div>
      <ServiceForm service={service} currencyOptions={currencyOptions} action={updateService.bind(null, id)} />

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Horario del servicio</h2>
        <ServiceHoursForm
          serviceId={id}
          initialHasCustomHours={serviceHours.hasCustomHours}
          initialHours={serviceHours.hours}
        />
      </div>
    </div>
  );
}
