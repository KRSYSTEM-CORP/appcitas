import { SignupForm } from "@/components/auth/SignupForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function SignupPage() {
  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 flex flex-col gap-6 p-6 py-16">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary),black_20%)] p-3 shadow-lg shadow-primary/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Crea tu negocio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Regístrate para empezar a gestionar tu agenda de citas.
            </p>
          </div>
        </div>
        <SignupForm />
      </div>
      <SiteFooter />
    </div>
  );
}
