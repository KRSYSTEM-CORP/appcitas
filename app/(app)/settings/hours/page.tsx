import { getBusinessConfig } from "@/lib/actions/business";
import { BusinessHoursForm } from "@/components/settings/BusinessHoursForm";

export default async function HoursSettingsPage() {
  const business = await getBusinessConfig();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Horario de atención</h2>
      <BusinessHoursForm initialHours={business.hours} />
    </section>
  );
}
