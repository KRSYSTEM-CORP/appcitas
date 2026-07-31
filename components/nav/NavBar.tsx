"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

const baseLinks = [
  { href: "/agenda", label: "Agenda" },
  { href: "/packages", label: "Paquetes" },
];

const ownerLinks = [
  { href: "/clients", label: "Clientes" },
  { href: "/services", label: "Servicios" },
  { href: "/specialists", label: "Especialistas" },
  { href: "/reports", label: "Reportes" },
  { href: "/settings", label: "Configuración" },
];

// Always last, regardless of role — visible to a SPECIALIST too since a
// billing block affects everyone at the business, not just the owner.
const subscriptionLink = { href: "/billing", label: "Suscripción mensual" };

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
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    ...baseLinks,
    ...(isOwner ? ownerLinks : []),
    ...(isSuperAdmin ? [{ href: "/admin", label: "Admin" }] : []),
    subscriptionLink,
  ];

  // Close the mobile menu automatically whenever the route actually changes
  // (tapping a link inside it), rather than requiring an explicit close tap.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="relative border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-1 px-4 md:px-6 h-14">
        <Link href="/agenda" className="flex items-center gap-2 min-w-0 mr-2 md:mr-4">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="" className="size-8 rounded object-cover shrink-0" />
          ) : (
            <div className="size-8 rounded bg-primary flex items-center justify-center shrink-0 p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="w-full h-full object-contain" />
            </div>
          )}
          <span className="font-semibold truncate max-w-[140px] md:max-w-[220px]">{businessName}</span>
        </Link>

        {/* Desktop: full link row inline. Hidden below md, where it moves
            into the dropdown panel instead so it never has to squeeze or
            horizontally scroll. */}
        <div className="hidden md:flex items-center gap-1 overflow-x-auto min-w-0">
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <form action={logout} className="hidden md:block">
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>

      {/* Mobile menu: stacked links with generous tap targets, plus logout
          that lives inline on desktop. */}
      {menuOpen && (
        <div className="md:hidden absolute inset-x-0 top-14 z-40 flex flex-col gap-1 border-b border-border bg-card p-3 shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2.5 text-sm rounded-md transition-colors ${
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-border pt-3">
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                Salir
              </Button>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}
