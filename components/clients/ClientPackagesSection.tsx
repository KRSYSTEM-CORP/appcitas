"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateAppointmentStatus } from "@/lib/actions/appointments";
import { CopyCancelLinkButton } from "@/components/shared/CopyCancelLinkButton";
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_STYLES, formatDate, formatTime } from "@/lib/format";
import type { PackageDetail } from "@/lib/actions/packages";
import type { AppointmentStatus } from "@prisma/client";

const STATUS_OPTIONS: AppointmentStatus[] = ["PENDING", "CONFIRMED", "ATTENDED", "NO_SHOW", "CANCELLED"];

export function ClientPackagesSection({ packages }: { packages: PackageDetail[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(appointmentId: string, status: AppointmentStatus) {
    startTransition(async () => {
      await updateAppointmentStatus(appointmentId, status);
      router.refresh();
    });
  }

  if (packages.length === 0) {
    return <p className="text-sm text-muted-foreground">Este cliente no tiene paquetes de sesiones.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {packages.map((pkg) => (
        <div key={pkg.id} className="rounded-md border border-border p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {pkg.service.name} con {pkg.specialist.displayName} · {pkg.sessionsAttended}/{pkg.totalSessions} asistidas
            </p>
            <Link
              href={`/packages/${pkg.id}`}
              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground shrink-0"
            >
              Ver paquete
            </Link>
          </div>

          <div className="flex flex-col gap-1.5">
            {pkg.appointments.map((a) => (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 ${APPOINTMENT_STATUS_STYLES[a.status]}`}
              >
                <span className="text-xs font-medium">
                  Sesión {a.sessionNumber} · {formatDate(a.startsAt)} {formatTime(a.startsAt)}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <CopyCancelLinkButton cancelToken={a.cancelToken} />
                  <select
                    value={a.status}
                    disabled={isPending}
                    onChange={(e) => handleStatusChange(a.id, e.target.value as AppointmentStatus)}
                    className="text-xs bg-transparent border-0 font-medium focus-visible:outline-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="bg-card text-foreground">
                        {APPOINTMENT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
