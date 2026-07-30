import Link from "next/link";
import { getBusinessConfig } from "@/lib/actions/business";

export default async function SettingsPage() {
  const business = await getBusinessConfig();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Acceso</h2>
      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 max-w-sm text-sm">
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
  );
}
