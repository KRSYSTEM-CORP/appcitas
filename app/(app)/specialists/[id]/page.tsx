import { notFound } from "next/navigation";
import { SpecialistForm } from "@/components/specialists/SpecialistForm";
import { getSpecialist, updateSpecialist } from "@/lib/actions/specialists";
import { listServices } from "@/lib/actions/services";

export default async function EditSpecialistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [specialist, services] = await Promise.all([getSpecialist(id), listServices()]);
  if (!specialist) notFound();

  return (
    <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold">Editar especialista</h1>
      </div>
      <SpecialistForm
        specialist={specialist}
        services={services.filter((s) => s.active || specialist.serviceIds.includes(s.id))}
        action={updateSpecialist.bind(null, id)}
      />
    </div>
  );
}
