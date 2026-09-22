"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallApp } from "@/lib/use-install-app";

// Only renders when the browser says this site can be installed right now —
// nothing to show once it's already installed or on a browser (Safari) that
// never offers the install prompt.
export function InstallAppButton({ className }: { className?: string }) {
  const { canInstall, install } = useInstallApp();
  if (!canInstall) return null;
  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={install}>
      <DownloadIcon />
      Instalar app
    </Button>
  );
}
