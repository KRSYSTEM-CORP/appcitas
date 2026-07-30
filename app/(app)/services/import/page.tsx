import { ImportServicesForm } from "@/components/services/ImportServicesForm";
import { getFxInfo } from "@/lib/actions/business";

export default async function ImportServicesPage() {
  const fx = await getFxInfo();
  const defaultCurrencyCode = fx.fxEnabled ? fx.foreignCurrencyCode : fx.localCurrencyCode;

  return (
    <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Importar servicios desde Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Crea varios servicios de una vez, o actualiza los que ya tienes subiendo el mismo archivo.
        </p>
      </div>
      <ImportServicesForm defaultCurrencyCode={defaultCurrencyCode} />
    </div>
  );
}
