import Link from "next/link";
import { verifyEmail } from "@/lib/actions/auth";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmail(token);

  return (
    <div className="flex flex-col min-h-full bg-gradient-to-b from-secondary/50 via-background to-background">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 py-16 text-center">
        {result.success ? (
          <>
            <h1 className="text-2xl font-semibold">Correo confirmado</h1>
            <p className="text-muted-foreground">Tu cuenta quedó verificada.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Enlace inválido</h1>
            <p className="text-muted-foreground">{result.error}</p>
          </>
        )}
        <Link href="/agenda" className="text-foreground underline underline-offset-4">
          Ir a mi agenda
        </Link>
      </div>
      <SiteFooter />
    </div>
  );
}
