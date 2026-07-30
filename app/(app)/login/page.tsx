import { LoginForm } from "@/components/auth/LoginForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function LoginPage() {
  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-secondary/50 via-background to-background">
      <div className="flex-1 flex flex-col gap-6 p-6 py-16">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),black_20%)] p-3 shadow-lg shadow-primary/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Inicia sesión</h1>
            <p className="text-sm text-muted-foreground mt-1">App Citas — agenda y reservas</p>
          </div>
        </div>
        <LoginForm />
      </div>
      <SiteFooter />
    </div>
  );
}
