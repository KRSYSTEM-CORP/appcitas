"use client";

import { InstallAppButton } from "@/components/nav/InstallAppButton";
import { useInstallApp } from "@/lib/use-install-app";

// Wraps InstallAppButton with a fallback for every case that button renders
// nothing on its own: already installed (nothing to show), or the browser
// never fired beforeinstallprompt — which is the NORMAL case on iPhone/iPad
// (Safari has no such event at all, ever) and can also happen on Android
// Chrome before it's decided the page is "installable enough" yet. Without
// this, mobile — especially iOS, the most common phone in practice — showed
// literally nothing where the button was supposed to be.
export function InstallAppPrompt() {
  const { canInstall, isInstalled } = useInstallApp();

  if (isInstalled) return null;
  if (canInstall) return <InstallAppButton />;

  return (
    <p className="text-xs text-muted-foreground text-center max-w-xs">
      Instala la app desde el menú del navegador: en <strong>Chrome o Edge</strong>, el ícono de
      instalar en la barra de direcciones (o menú → «Instalar KR Citas»); en{" "}
      <strong>Safari (iPhone o Mac)</strong>, Compartir → «Añadir a pantalla de inicio» / «Añadir
      al Dock».
    </p>
  );
}
