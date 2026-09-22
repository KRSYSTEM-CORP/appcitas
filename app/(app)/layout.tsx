import type { Metadata } from "next";
import { NavBar } from "@/components/nav/NavBar";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { getSession } from "@/lib/session";
import { getBranding } from "@/lib/actions/business";
import { deriveBrandVars } from "@/lib/theme-color";
import { KrCitasTour } from "@/components/onboarding/KrCitasTour";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  return { title: session ? `${session.businessName} · KR Citas` : "KR Citas - By KR System" };
}

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const branding = session
    ? await getBranding()
    : { logoDataUrl: null, brandColor: null, brandBackground: null };
  const brandVars = deriveBrandVars(branding.brandBackground, branding.brandColor);

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={brandVars as React.CSSProperties}>
      {/* Registered here (the authenticated app shell) and ONLY here — never
          in the root app/layout.tsx, which also wraps the public
          customer-facing booking widget at /book/[subdomain]. A customer who
          only ever visits that page never triggers this at all. See
          public/sw.js for how it keeps the two areas separate regardless. */}
      <ServiceWorkerRegistration />
      {session && (
        <NavBar
          businessName={session.businessName}
          logoDataUrl={branding.logoDataUrl}
          isOwner={session.role === "OWNER"}
          isSuperAdmin={session.isSuperAdmin}
        />
      )}
      {session && <KrCitasTour hasSeenTour={session.hasSeenTour} />}
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
