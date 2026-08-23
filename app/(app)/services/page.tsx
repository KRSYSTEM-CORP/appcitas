import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ServiceTable } from "@/components/services/ServiceTable";
import { listServices } from "@/lib/actions/services";
import { getFxInfo } from "@/lib/actions/business";

export default async function ServicesPage() {
  const [services, fx] = await Promise.all([listServices(), getFxInfo()]);

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Servicios</h1>
          <p className="text-sm text-muted-foreground mt-1">El catálogo que tus especialistas pueden ofrecer.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/services/import" className={buttonVariants({ variant: "outline" })}>
            Importar desde Excel
          </Link>
          <Link href="/services/new" className={buttonVariants({})}>
            Nuevo servicio
          </Link>
        </div>
      </div>

      <ServiceTable services={services} currencyCode={fx.localCurrencyCode} rate={fx.rate} />
    </div>
  );
}
