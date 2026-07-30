"use client";

import { useState } from "react";

type ClientRow = { id: string; firstName: string; lastName: string; phone: string; appointmentCount: number };

const SEGMENTS = [
  { key: "new", label: "Nuevos" },
  { key: "recurring", label: "Recurrentes" },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]["key"];

// Shows one client list at a time instead of both always stacked — picking
// a segment keeps the page from dumping every new AND every recurring
// client on screen at once.
export function ClientsSegmentView({
  newClients,
  recurringClients,
}: {
  newClients: ClientRow[];
  recurringClients: ClientRow[];
}) {
  const [segment, setSegment] = useState<SegmentKey>("new");
  const rows = segment === "new" ? newClients : recurringClients;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSegment(s.key)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              segment === s.key ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
            }`}
          >
            {s.label} ({s.key === "new" ? newClients.length : recurringClients.length})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ningún cliente {segment === "new" ? "nuevo" : "recurrente"} en este período.
        </p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          {rows.map((c, i) => (
            <div key={c.id} className={`flex justify-between px-4 py-2 text-sm ${i > 0 ? "border-t border-border" : ""}`}>
              <span>
                {c.firstName} {c.lastName} <span className="text-muted-foreground">· {c.phone}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">{c.appointmentCount} citas</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
