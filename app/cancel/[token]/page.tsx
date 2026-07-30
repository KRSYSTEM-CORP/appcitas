import type { Metadata } from "next";
import { CancelAppointmentView } from "@/components/public/CancelAppointmentView";
import { getAppointmentByCancelToken } from "@/lib/actions/public";
import { deriveBrandVars } from "@/lib/theme-color";

export const metadata: Metadata = { title: "Cancelar cita" };

export default async function CancelAppointmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appointment = await getAppointmentByCancelToken(token);

  if (!appointment) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Enlace inválido</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Este enlace de cancelación no corresponde a ninguna cita.
        </p>
      </div>
    );
  }

  const brandVars = deriveBrandVars(appointment.business.brandBackground, appointment.business.brandColor);

  return (
    <div
      className="min-h-full flex flex-col bg-background text-foreground"
      style={brandVars as React.CSSProperties}
    >
      <header className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        {appointment.business.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={appointment.business.logoDataUrl} alt="" className="size-16 rounded-xl object-cover" />
        ) : (
          <div className="size-16 rounded-xl bg-primary flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="w-full h-full object-contain" />
          </div>
        )}
        <h2 className="text-lg font-semibold">{appointment.business.name}</h2>
      </header>
      <main className="flex-1 px-6 pb-16 flex items-start justify-center">
        <CancelAppointmentView appointment={appointment} token={token} />
      </main>
    </div>
  );
}
