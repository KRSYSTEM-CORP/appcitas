import { openDB, type IDBPDatabase } from "idb";
import type { AppointmentStatus } from "@prisma/client";
import type { SpecialistListItem } from "@/lib/actions/specialists";
import type { ServiceListItem } from "@/lib/actions/services";

const DB_NAME = "kr-citas-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-appointments";
const SNAPSHOT_STORE_NAME = "agenda-snapshot";

// The exact shape createAppointment() expects — kept separate from the
// offline form's own state so a queued appointment re-submits identically to
// what an online "Nueva cita" would have sent.
export type PendingAppointmentInput = {
  newClient: { firstName: string; lastName: string; phone: string };
  specialistId?: string;
  serviceId: string;
  dateKey: string;
  time: string;
  notes?: string;
};

// Enough to render the queued appointment in the sync banner/review screen
// before it actually exists server-side.
export type PendingAppointmentPreview = {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  specialistName: string | null; // null = "Sin asignar"
  dateKey: string;
  time: string;
};

export type PendingAppointment = {
  localId: string;
  queuedAt: string;
  input: PendingAppointmentInput;
  preview: PendingAppointmentPreview;
  lastError?: string;
};

// A single snapshot per business of everything /agenda/offline needs to
// render a working agenda screen with zero network — today's appointments
// (read-only), the specialist/service lists needed to create a walk-in, and
// currency info for informational price display. Written by
// lib/offline/use-agenda-sync.ts every time the real /agenda page renders
// successfully; read by AgendaOfflineClient. Deliberately excludes payment
// history (Appointment.transactions) — that's out of scope offline and has
// no reason to sit unencrypted in this device's IndexedDB.
export type AgendaSnapshotAppointment = {
  id: string;
  startsAt: string; // ISO — Date doesn't survive structured-clone/JSON round trips as cleanly across tab reloads
  endsAt: string;
  status: AppointmentStatus;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  specialistId: string | null;
  specialistName: string | null;
  serviceName: string;
};

export type AgendaSnapshot = {
  businessId: string;
  businessName: string;
  savedAt: string;
  specialists: SpecialistListItem[];
  services: ServiceListItem[];
  todayAppointments: AgendaSnapshotAppointment[];
  localCurrencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  rate: number | null;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

// IndexedDB doesn't exist during SSR/build, and in principle a browser could
// lack it too (private-mode restrictions on some old browsers) — every
// caller treats a null db as "offline storage unavailable" rather than
// throwing, since queuing is a best-effort convenience, not the appointment
// itself.
function getDb(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "localId" });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
          db.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: "businessId" });
        }
      },
      // Mobile Safari/iOS closes an open IndexedDB connection out from under
      // the page — silently, in the background, under memory pressure —
      // without the page ever calling db.close() itself. Without this, the
      // cached dbPromise above keeps resolving to that now-dead connection
      // forever, and every operation on it throws (see withDb's retry below
      // — same fix already proven out for this exact bug in the sister app,
      // KR POS, Sentry KRPOS-8/KRPOS-9). Clearing the cache here just means
      // the next call opens a fresh connection instead of reusing a dead one.
      terminated() {
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

// Runs `op` against a fresh-enough connection, retrying once with a brand
// new connection if the cached one turns out to be dead — covers the case
// where the browser closed it without terminated() having fired yet (or at
// all; Safari's own close notifications are unreliable), which otherwise
// surfaces as the op itself throwing InvalidStateError/UnknownError.
async function withDb<T>(op: (db: IDBPDatabase) => Promise<T>, fallback: T): Promise<T> {
  const db = await getDb();
  if (!db) return fallback;
  try {
    return await op(db);
  } catch (err) {
    dbPromise = null;
    const retryDb = await getDb();
    if (!retryDb) return fallback;
    try {
      return await op(retryDb);
    } catch {
      // Still failing on a fresh connection — genuinely unavailable (e.g.
      // storage disabled), not just a stale handle. Offline queuing is
      // best-effort, so give up quietly rather than throwing into a caller
      // that's already treating this as "storage unavailable."
      console.error("[offline-db] operation failed after reconnect:", err);
      return fallback;
    }
  }
}

export async function addPendingAppointment(appointment: PendingAppointment): Promise<void> {
  await withDb((db) => db.put(STORE_NAME, appointment), undefined);
}

export async function listPendingAppointmentsRaw(): Promise<PendingAppointment[]> {
  return withDb((db) => db.getAll(STORE_NAME), []);
}

export async function removePendingAppointment(localId: string): Promise<void> {
  await withDb((db) => db.delete(STORE_NAME, localId), undefined);
}

export async function setPendingAppointmentError(localId: string, error: string): Promise<void> {
  await withDb(async (db) => {
    const existing = await db.get(STORE_NAME, localId);
    if (existing) await db.put(STORE_NAME, { ...existing, lastError: error });
  }, undefined);
}

// Best-effort, fire-and-forget like the rest of this file — a failed write
// just means the offline shell falls back to "no agenda saved yet" next
// time, not a user-facing error while online.
export async function putAgendaSnapshot(snapshot: AgendaSnapshot): Promise<void> {
  await withDb((db) => db.put(SNAPSHOT_STORE_NAME, snapshot), undefined);
}

export async function getAgendaSnapshot(businessId: string): Promise<AgendaSnapshot | undefined> {
  return withDb((db) => db.get(SNAPSHOT_STORE_NAME, businessId), undefined);
}
