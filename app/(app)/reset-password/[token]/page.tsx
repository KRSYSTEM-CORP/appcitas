import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-secondary/50 via-background to-background">
      <div className="flex-1 flex flex-col gap-6 p-6 py-16">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Crea tu nueva contraseña</h1>
        </div>
        <ResetPasswordForm token={token} />
      </div>
      <SiteFooter />
    </div>
  );
}
