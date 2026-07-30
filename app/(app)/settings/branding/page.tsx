import { getBusinessConfig } from "@/lib/actions/business";
import { BrandingForm } from "@/components/settings/BrandingForm";

export default async function BrandingSettingsPage() {
  const business = await getBusinessConfig();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Marca</h2>
      <BrandingForm
        currentName={business.name}
        currentLogo={business.logoDataUrl}
        currentColor={business.brandColor}
        currentBackground={business.brandBackground}
      />
    </section>
  );
}
