import { ServiceForm } from "@/components/services/ServiceForm";
import { createService } from "@/lib/actions/services";
import { getFxInfo } from "@/lib/actions/business";

export default async function NewServicePage() {
  const fx = await getFxInfo();
  const currencyOptions = fx.fxEnabled ? [fx.foreignCurrencyCode, fx.localCurrencyCode] : [fx.localCurrencyCode];

  return (
    <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo servicio</h1>
        <p className="text-sm text-muted-foreground mt-1">Agrégalo a tu catálogo para poder asignarlo a un especialista.</p>
      </div>
      <ServiceForm action={createService} currencyOptions={currencyOptions} />
    </div>
  );
}
