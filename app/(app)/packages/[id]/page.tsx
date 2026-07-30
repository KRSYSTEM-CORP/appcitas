import { notFound } from "next/navigation";
import { getPackage } from "@/lib/actions/packages";
import { getFxInfo } from "@/lib/actions/business";
import { requireSession } from "@/lib/session";
import { PackageDetailView } from "@/components/packages/PackageDetailView";

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, pkg, fx] = await Promise.all([requireSession(), getPackage(id), getFxInfo()]);
  if (!pkg) notFound();

  return (
    <PackageDetailView
      pkg={pkg}
      currencyCode={fx.localCurrencyCode}
      fxEnabled={fx.fxEnabled}
      foreignCurrencyCode={fx.foreignCurrencyCode}
      rate={fx.rate}
      businessName={session.businessName}
    />
  );
}
