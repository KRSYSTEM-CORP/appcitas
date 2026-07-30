import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-secondary/50 via-background to-background">
      <div className="flex-1 flex flex-col gap-6 p-6 py-16">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Recupera tu contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ingresa tu correo y te enviamos un enlace para crear una nueva contraseña.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
      <SiteFooter />
    </div>
  );
}
