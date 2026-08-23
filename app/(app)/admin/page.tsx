import { StatCard } from "@/components/reports/StatCard";
import { AdminBusinessTable } from "@/components/admin/AdminBusinessTable";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { PlatformSettingsForm, PendingReportsTable } from "@/components/admin/PaymentReportsPanel";
import {
  listBusinessesForAdmin,
  listAnnouncementRecipients,
  listPendingPaymentReports,
  getPlatformSettings,
} from "@/lib/actions/admin";

export default async function AdminPage() {
  const [businesses, announcementRecipients, pendingReports, platformSettings] = await Promise.all([
    listBusinessesForAdmin(),
    listAnnouncementRecipients(),
    listPendingPaymentReports(),
    getPlatformSettings(),
  ]);
  const pending = businesses.filter((b) => b.ownerStatus === "PENDING").length;
  const active = businesses.filter((b) => b.ownerStatus === "ACTIVE").length;
  const suspended = businesses.filter((b) => b.ownerStatus === "SUSPENDED").length;

  return (
    <div className="flex flex-col gap-6 p-6 w-full">
      <div>
        <h1 className="text-2xl font-semibold">Administración de KR System</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprueba, deniega y controla el acceso de cada negocio registrado en la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Pendientes" value={String(pending)} />
        <StatCard label="Activos" value={String(active)} />
        <StatCard label="Suspendidos" value={String(suspended)} />
      </div>

      <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cobro de suscripción mensual</h2>
        <PlatformSettingsForm
          initialInstructions={platformSettings.paymentInstructions}
          initialBinanceQrDataUrl={platformSettings.binanceQrDataUrl}
          initialBinanceId={platformSettings.binanceId}
          initialDefaultMonthlyFeeUsdCents={platformSettings.defaultMonthlyFeeUsdCents}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Reportes de pago pendientes ({pendingReports.length})</h2>
        <PendingReportsTable reports={pendingReports} />
      </div>

      <AdminBusinessTable businesses={businesses} />

      <AnnouncementForm recipientCount={announcementRecipients.length} />
    </div>
  );
}
