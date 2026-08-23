import { SpecialistForm } from "@/components/specialists/SpecialistForm";
import { createSpecialist } from "@/lib/actions/specialists";
import { listServices } from "@/lib/actions/services";

export default async function NewSpecialistPage() {
  const services = await listServices();

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo especialista</h1>
      </div>
      <SpecialistForm services={services.filter((s) => s.active)} action={createSpecialist} />
    </div>
  );
}
