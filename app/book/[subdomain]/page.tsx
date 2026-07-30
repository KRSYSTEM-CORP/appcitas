import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingWidget } from "@/components/public/BookingWidget";
import { getPublicBusiness, listPublicCatalog } from "@/lib/actions/public";
import { deriveBrandVars } from "@/lib/theme-color";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const business = await getPublicBusiness(subdomain);
  return { title: business ? `Reservar en ${business.name}` : "Negocio no encontrado" };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = await params;
  const business = await getPublicBusiness(subdomain);
  if (!business) notFound();

  const { services, specialists } = await listPublicCatalog(business.id);
  const brandVars = deriveBrandVars(business.brandBackground, business.brandColor);

  return (
    <div
      className="min-h-full flex flex-col bg-background text-foreground"
      style={brandVars as React.CSSProperties}
    >
      <header className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        {business.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logoDataUrl} alt="" className="size-16 rounded-xl object-cover" />
        ) : (
          <div className="size-16 rounded-xl bg-primary flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <h1 className="text-2xl font-semibold">{business.name}</h1>
        <p className="text-sm text-muted-foreground">Reserva tu cita en línea</p>
      </header>

      <main className="flex-1 px-6 pb-16">
        {services.length === 0 || specialists.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Este negocio todavía no tiene servicios o especialistas disponibles para reservar en línea.
          </p>
        ) : (
          <BookingWidget
            subdomain={business.subdomain}
            businessId={business.id}
            services={services}
            specialists={specialists}
            currencyCode={business.localCurrencyCode}
            rate={business.rate}
          />
        )}
      </main>
    </div>
  );
}
