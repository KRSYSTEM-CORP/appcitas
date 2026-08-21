import { notFound } from "next/navigation";
import { SpecialistForm } from "@/components/specialists/SpecialistForm";
import { SpecialistHoursForm } from "@/components/specialists/SpecialistHoursForm";
import { getSpecialist, getSpecialistHours, updateSpecialist } from "@/lib/actions/specialists";
import { listServices } from "@/lib/actions/services";

export default async function EditSpecialistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [specialist, services, specialistHours] = await Promise.all([
    getSpecialist(id),
    listServices(),
    getSpecialistHours(id),
  ]);
  if (!specialist || !specialistHours) notFound();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Editar especialista</h1>
      </div>
      <SpecialistForm
        specialist={specialist}
        services={services.filter((s) => s.active || specialist.serviceIds.includes(s.id))}
        action={updateSpecialist.bind(null, id)}
      />

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Horario de trabajo</h2>
        <SpecialistHoursForm
          specialistId={id}
          initialHasCustomHours={specialistHours.hasCustomHours}
          initialHours={specialistHours.hours}
        />
      </div>
    </div>
  );
}
