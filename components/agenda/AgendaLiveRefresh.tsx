"use client";

import { useLiveRefresh } from "@/lib/useLiveRefresh";

// Renders nothing — just keeps the agenda page in sync with appointments
// booked from the public booking page (or cancelled, or edited from another
// open tab) by refreshing this route whenever a live ping arrives.
export function AgendaLiveRefresh({ businessId }: { businessId: string }) {
  useLiveRefresh(`citas:${businessId}`, "appointment");
  return null;
}
