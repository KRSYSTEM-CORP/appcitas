import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BlockedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.billingBlocked) redirect("/agenda");

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 py-16">
      <div className="max-w-md w-full rounded-md border border-border bg-card p-6 flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Acceso bloqueado</h1>
        <p className="text-sm">
          <span className="font-medium">{session.businessName}</span> tiene el mantenimiento de la
          plataforma vencido{" "}
          {session.nextPaymentDueDate && <>desde el {formatDate(session.nextPaymentDueDate)}</>}.
        </p>
        {session.monthlyFeeUsdCents != null && (
          <p className="text-sm">
            Monto pendiente:{" "}
            <span className="font-medium">{formatMoney(session.monthlyFeeUsdCents, "USD")}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Reporta tu pago y el super admin lo verificará. El acceso se restablece automáticamente
          en cuanto se apruebe.
        </p>
        <Link href="/billing" className={buttonVariants({})}>
          Ver método de pago y reportar
        </Link>
      </div>
    </div>
  );
}
