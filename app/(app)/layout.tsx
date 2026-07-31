import type { Metadata } from "next";
import { NavBar } from "@/components/nav/NavBar";
import { getSession } from "@/lib/session";
import { getBranding } from "@/lib/actions/business";
import { deriveBrandVars } from "@/lib/theme-color";

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
      {session && (
        <NavBar
          businessName={session.businessName}
          logoDataUrl={branding.logoDataUrl}
          isOwner={session.role === "OWNER"}
          isSuperAdmin={session.isSuperAdmin}
        />
      )}
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
