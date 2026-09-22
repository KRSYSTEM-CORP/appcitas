import { AppInstallGuide } from "@/components/settings/AppInstallGuide";
import { requireOwner } from "@/lib/session";

// Configuración is owner-only real estate throughout this app (see
// NavBar.tsx's ownerLinks and every other /settings/* page's data action
// calling requireOwner internally) — this tab matches that, even though the
// guide itself has no owner-specific data to fetch.
export default async function SettingsInstallPage() {
  await requireOwner();
  return <AppInstallGuide />;
}
