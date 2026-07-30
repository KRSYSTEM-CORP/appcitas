"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "Acceso" },
  { href: "/settings/branding", label: "Marca" },
  { href: "/settings/hours", label: "Horario" },
  { href: "/settings/currency", label: "Multidivisa" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
