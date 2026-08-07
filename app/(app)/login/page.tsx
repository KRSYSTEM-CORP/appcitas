import { LoginForm } from "@/components/auth/LoginForm";
import { WelcomeModal } from "@/components/auth/WelcomeModal";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WHATSAPP_URL } from "@/lib/legal";
import { googleOAuthConfigured } from "@/lib/google-oauth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-secondary/50 via-background to-background">
      <WelcomeModal />
      <div className="flex-1 flex flex-col gap-6 p-6 py-16">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),black_20%)] p-3 shadow-lg shadow-primary/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Inicia sesión</h1>
            <p className="text-sm text-muted-foreground mt-1">KR Citas — agenda y reservas</p>
          </div>
        </div>
        <LoginForm googleConfigured={googleOAuthConfigured()} authError={error} />
        <p className="text-center text-sm text-muted-foreground">
          ¿Quieres este sistema para tu negocio o más información?{" "}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
