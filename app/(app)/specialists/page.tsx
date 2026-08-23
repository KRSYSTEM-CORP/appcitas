import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SpecialistTable } from "@/components/specialists/SpecialistTable";
import { listSpecialists } from "@/lib/actions/specialists";

export default async function SpecialistsPage() {
  const specialists = await listSpecialists();

  return (
    <div className="flex flex-col gap-4 p-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Especialistas</h1>
          <p className="text-sm text-muted-foreground mt-1">Tu equipo y qué servicios puede atender cada quien.</p>
        </div>
        <Link href="/specialists/new" className={buttonVariants({})}>
          Nuevo especialista
        </Link>
      </div>

      <SpecialistTable specialists={specialists} />
    </div>
  );
}
