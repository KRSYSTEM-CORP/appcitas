import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function NavBar({
  businessName,
  logoDataUrl,
  isOwner,
  isSuperAdmin,
}: {
  businessName: string;
  logoDataUrl: string | null;
  isOwner: boolean;
  isSuperAdmin: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
      <Link href="/agenda" className="flex items-center gap-2 min-w-0">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} alt="" className="size-8 rounded object-cover shrink-0" />
        ) : (
          <div className="size-8 rounded bg-primary flex items-center justify-center shrink-0 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <span className="font-semibold truncate">{businessName}</span>
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        <Link href="/agenda" className="text-muted-foreground hover:text-foreground">
          Agenda
        </Link>
        <Link href="/packages" className="text-muted-foreground hover:text-foreground">
          Paquetes
        </Link>
        {isOwner && (
          <>
            <Link href="/clients" className="text-muted-foreground hover:text-foreground">
              Clientes
            </Link>
            <Link href="/services" className="text-muted-foreground hover:text-foreground">
              Servicios
            </Link>
            <Link href="/specialists" className="text-muted-foreground hover:text-foreground">
              Especialistas
            </Link>
            <Link href="/reports" className="text-muted-foreground hover:text-foreground">
              Reportes
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground">
              Configuración
            </Link>
          </>
        )}
        {isSuperAdmin && (
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            Admin
          </Link>
        )}
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Salir
          </Button>
        </form>
      </nav>
    </header>
  );
}
