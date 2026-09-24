"use client";

import { useInstallApp } from "@/lib/use-install-app";

// Installing the app and working through a connection outage. Everything
// here is browser/system configuration, not something the app itself needs
// to "update" — KR Citas always runs connected to the internet and updates
// itself with each deploy, whether installed or opened in a plain tab. The
// install button itself only lives on the login screen (before signing in,
// see app/(app)/login/page.tsx) — this tab is pure documentation for anyone
// who missed it there.
export function AppInstallGuide() {
  const { isInstalled } = useInstallApp();

  return (
    <div className="flex flex-col gap-3 max-w-2xl">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Instalar KR Citas en este equipo</h2>
        {isInstalled && (
          <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-xs font-medium">Instalada</span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Se abre en su propia ventana, con su icono en el escritorio o la barra de tareas. Además,
        una vez instalada, la agenda de hoy sigue funcionando aunque se corte la luz o el
        internet — las citas que agendes sin conexión se guardan en el equipo y se sincronizan
        solas apenas vuelva la conexión.
      </p>
      {!isInstalled && (
        <p className="text-sm text-muted-foreground">
          El botón para instalarla aparece en la pantalla de inicio de sesión, antes de entrar —
          si no lo viste ahí, instálala desde el navegador: en <strong>Chrome o Edge</strong>, el
          icono de instalar en la barra de direcciones (o menú → «Instalar KR Citas»); en{" "}
          <strong>Safari en Mac</strong>, Compartir → «Añadir al Dock»; en <strong>Safari en iPhone/iPad</strong>, Compartir → «Añadir a pantalla de inicio» (es siempre manual en iPhone, Apple no permite instalar con un botón).
        </p>
      )}
    </div>
  );
}
