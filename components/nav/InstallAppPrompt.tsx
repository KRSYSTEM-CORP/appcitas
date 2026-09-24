"use client";

import { useSyncExternalStore } from "react";
import { Share, SquarePlus } from "lucide-react";
import { InstallAppButton } from "@/components/nav/InstallAppButton";
import { useInstallApp } from "@/lib/use-install-app";

// iPhone/iPad Safari (and every other iOS browser — Apple forces them all
// onto WebKit, so Chrome/Firefox on iOS have the exact same restriction).
// Detected once per mount, not reactively — a device's platform doesn't
// change mid-session. iPadOS 13+ reports as "MacIntel" in desktop mode, so
// touch support is the only way to tell it apart from a real Mac — but an
// Android device is checked first and short-circuits that fallback, since
// "MacIntel" + touch points can also show up there under some emulation/
// browser combinations (confirmed live: Chrome's own mobile-device
// emulation reports the *host* machine's real platform/touch capabilities
// alongside a spoofed Android user agent).
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return false;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const noopSubscribe = () => () => {};

// Wraps InstallAppButton with a fallback for every case that button renders
// nothing on its own: already installed (nothing to show), or the browser
// never fired beforeinstallprompt. On iOS that's not a maybe — Apple gives
// no website ANY way to trigger an install programmatically, on any
// browser, on any iPhone/iPad; Compartir → "Añadir a pantalla de inicio" is
// the only path that exists, done by the person themselves in Safari's own
// UI. This shows that exact sequence with its real icons instead of a
// paragraph of text, since it's the closest to "one clear tap" iOS allows.
export function InstallAppPrompt() {
  const { canInstall, isInstalled } = useInstallApp();
  // Avoids a server/client markup mismatch — navigator doesn't exist during
  // SSR, so this only evaluates once mounted in the browser.
  const ios = useSyncExternalStore(noopSubscribe, isIOS, () => false);

  if (isInstalled) return null;
  if (canInstall) return <InstallAppButton />;

  if (ios) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm max-w-xs">
        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <Share className="size-4" />
          <span className="text-xs">→</span>
          <SquarePlus className="size-4" />
        </div>
        <p className="text-muted-foreground text-left">
          Toca <strong>Compartir</strong> abajo en Safari y luego <strong>«Añadir a pantalla de
          inicio»</strong>.
        </p>
      </div>
    );
  }

  return (
    <p className="text-xs text-muted-foreground text-center max-w-xs">
      Instala la app desde el menú del navegador: en <strong>Chrome o Edge</strong>, el ícono de
      instalar en la barra de direcciones (o menú → «Instalar KR Citas»).
    </p>
  );
}
