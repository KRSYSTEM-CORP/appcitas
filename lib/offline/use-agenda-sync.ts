"use client";

import { useEffect } from "react";
import { putAgendaSnapshot, type AgendaSnapshot, type AgendaSnapshotAppointment } from "@/lib/offline/db";
import type { SpecialistListItem } from "@/lib/actions/specialists";
import type { ServiceListItem } from "@/lib/actions/services";

// Read synchronously (before any IndexedDB round-trip) by AgendaOfflineClient
// so it knows WHICH business's snapshot to look up without an async lookup
// first — IndexedDB's own snapshot store is keyed by businessId, so
// something has to say which businessId to ask for before that query can
// even run.
const LAST_BUSINESS_KEY = "kr-citas-last-business";

export type LastBusinessInfo = { businessId: string; businessName: string };

export function readLastBusiness(): LastBusinessInfo | null {
  try {
    const raw = localStorage.getItem(LAST_BUSINESS_KEY);
    return raw ? (JSON.parse(raw) as LastBusinessInfo) : null;
  } catch {
    return null;
  }
}

function writeLastBusiness(info: LastBusinessInfo) {
  try {
    localStorage.setItem(LAST_BUSINESS_KEY, JSON.stringify(info));
  } catch {
    // Best-effort — a missing localStorage entry just means the offline
    // shell shows its "no agenda saved yet" state, not a crash.
  }
}

// Keeps IndexedDB's agenda snapshot for this business warm every time the
// real (online) /agenda page renders with fresh server props — see
// app/(app)/agenda/page.tsx. Fires on mount and again whenever `specialists`/
// `services`/`todayAppointments` actually change reference, which only
// happens when the page re-fetches from the server (initial load, or a
// router.refresh() from AgendaLiveRefresh) — NOT on every local UI
// interaction, since those never touch these prop references. Best-effort,
// no loading state or error surfaced to the user, same posture as
// queueAppointment.
export function useAgendaSync(params: {
  businessId: string;
  businessName: string;
  specialists: SpecialistListItem[];
  services: ServiceListItem[];
  todayAppointments: AgendaSnapshotAppointment[];
  localCurrencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  rate: number | null;
}) {
  const { businessId, businessName, specialists, services, todayAppointments } = params;
  useEffect(() => {
    const snapshot: AgendaSnapshot = {
      businessId,
      businessName,
      savedAt: new Date().toISOString(),
      specialists,
      services,
      todayAppointments,
      localCurrencyCode: params.localCurrencyCode,
      fxEnabled: params.fxEnabled,
      foreignCurrencyCode: params.foreignCurrencyCode,
      rate: params.rate,
    };
    putAgendaSnapshot(snapshot);
    writeLastBusiness({ businessId, businessName });
    // Only the values that actually identify "the data changed" are worth
    // depending on — the currency/rate fields all change in lockstep with
    // these (same server render), so re-listing every field here would just
    // be noise for the linter without changing behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, businessName, specialists, services, todayAppointments]);
}
