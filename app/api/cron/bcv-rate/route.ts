import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withSuperAdmin } from "@/lib/tenant-db";
import { fetchBcvRate } from "@/lib/bcv-rate";
import { PLATFORM_SETTINGS_ID } from "@/lib/billing";
import { invalidateCache } from "@/lib/cache";

// Runs once a day at 00:00 Venezuela time (04:00 UTC — Vercel cron schedules
// always run in UTC, see vercel.json's "crons" entry) and refreshes every
// FX-enabled VES business's exchange rate automatically. Also refreshes
// PlatformSettings.platformExchangeRate the same way — KR System's own
// USD/Bs rate for pricing the subscription's Pago Móvil amount (see
// getPlatformExchangeRateInfo, lib/actions/billing.ts), independent of any
// one business' own rate above. Vercel signs its own cron requests with
// `Authorization: Bearer $CRON_SECRET` once that env var is set on the
// project, which is what's checked below.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [usdRate, eurRate] = await Promise.allSettled([fetchBcvRate("USD"), fetchBcvRate("EUR")]);

  const results = await withSuperAdmin(async (tx) => {
    const businesses = await tx.business.findMany({
      where: { localCurrencyCode: "VES", fxEnabled: true, foreignCurrencyCode: { in: ["USD", "EUR"] } },
      select: { id: true, foreignCurrencyCode: true },
    });

    let updated = 0;
    let skipped = 0;
    for (const business of businesses) {
      const rateResult = business.foreignCurrencyCode === "USD" ? usdRate : eurRate;
      if (rateResult.status !== "fulfilled") {
        skipped++;
        continue;
      }
      await tx.business.update({
        where: { id: business.id },
        data: { exchangeRate: rateResult.value, exchangeRateUpdatedAt: new Date() },
      });
      updated++;
    }
    return { total: businesses.length, updated, skipped };
  });

  let platformRateUpdated = false;
  if (usdRate.status === "fulfilled") {
    await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: { id: PLATFORM_SETTINGS_ID, platformExchangeRate: usdRate.value, platformExchangeRateUpdatedAt: new Date() },
      update: { platformExchangeRate: usdRate.value, platformExchangeRateUpdatedAt: new Date() },
    });
    await invalidateCache("platformExchangeRateInfo");
    platformRateUpdated = true;
  }

  return NextResponse.json({
    ok: true,
    usdRate: usdRate.status === "fulfilled" ? usdRate.value : null,
    eurRate: eurRate.status === "fulfilled" ? eurRate.value : null,
    platformRateUpdated,
    ...results,
  });
}
