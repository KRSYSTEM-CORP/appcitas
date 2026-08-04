"use client";

import { useEffect, useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { buildWhatsAppPromoLink } from "@/lib/whatsapp";
import type { ClientCrmItem } from "@/lib/actions/clients";

// A client hasn't visited "in a while" past this many days — highlighted as
// a reactivation priority. Arbitrary but reasonable for a service business;
// not configurable since there's no other signal (industry, visit cadence)
// to base a smarter default on.
const STALE_DAYS_THRESHOLD = 30;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60_000));
}

export function CrmTable({
  clients,
  businessName,
  bookingPath,
}: {
  clients: ClientCrmItem[];
  businessName: string;
  bookingPath: string;
}) {
  const [, startTransition] = useTransition();
  // Filled in after mount, not during render, so the client's first render
  // still matches the server-rendered HTML (window is unavailable server-side).
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => startTransition(() => setOrigin(window.location.origin)), []);

  if (clients.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aún no tienes clientes registrados.</p>;
  }

  return (
    <div className="rounded-md border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Cliente</th>
            <th className="px-4 py-2 font-medium">Última visita</th>
            <th className="px-4 py-2 font-medium">Último servicio</th>
            <th className="px-4 py-2 font-medium text-right">Visitas</th>
            <th className="px-4 py-2 font-medium text-right">Contactar</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const clientName = `${c.firstName} ${c.lastName}`;
            const stale = c.lastVisit === null || daysSince(c.lastVisit) >= STALE_DAYS_THRESHOLD;
            const link = buildWhatsAppPromoLink({
              phone: c.phone,
              clientName,
              businessName,
              lastServiceName: c.lastServiceName,
              lastVisit: c.lastVisit,
              bookingUrl: origin ? `${origin}${bookingPath}` : undefined,
            });
            return (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{clientName}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{c.phone}</div>
                </td>
                <td className="px-4 py-2">
                  {c.lastVisit === null ? (
                    <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Nunca ha asistido
                    </span>
                  ) : (
                    <div className="flex flex-col">
                      <span>{formatDate(c.lastVisit)}</span>
                      <span className={`text-xs ${stale ? "text-destructive" : "text-muted-foreground"}`}>
                        hace {daysSince(c.lastVisit)} día{daysSince(c.lastVisit) === 1 ? "" : "s"}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{c.lastServiceName ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{c.totalVisits}</td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: stale ? "default" : "outline", size: "sm" }))}
                  >
                    <MessageCircle className="size-4" />
                    Promocionar
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
