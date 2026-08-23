import Link from "next/link";
import { getBusinessConfig } from "@/lib/actions/business";
import { SpecialistAssignmentModeForm } from "@/components/settings/SpecialistAssignmentModeForm";

export default async function SettingsPage() {
  const business = await getBusinessConfig();

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold">Acceso</h2>
          <p className="text-sm text-muted-foreground mt-1">
            El enlace de reservas y el código con el que tu equipo entra a KR Citas.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 text-sm">
          <div className="flex justify-between gap-4 items-center">
            <span className="text-muted-foreground">Página de reservas</span>
            <Link
              href={`/book/${business.subdomain}`}
              target="_blank"
              className="font-medium text-primary underline underline-offset-4"
            >
              /book/{business.subdomain}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Compártelo con tus clientes para que reserven sin necesidad de llamarte.
          </p>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Código de acceso para el equipo</span>
            <span className="font-medium tabular-nums">{business.loginCode}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold">Asignación de especialista</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ¿Quién decide qué especialista atiende cada cita reservada desde tu página pública?
          </p>
        </div>
        <SpecialistAssignmentModeForm initialMode={business.specialistAssignmentMode} />
      </section>
    </div>
  );
}
