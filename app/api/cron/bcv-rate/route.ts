import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchBcvRate } from "@/lib/bcv-rate";
import { PLATFORM_SETTINGS_ID } from "@/lib/billing";

// Runs once a day (see vercel.json's "crons" entry) and refreshes every
// FX-enabled VES business's exchange rate automatically. Also refreshes
// PlatformSettings.billingExchangeRate, the separate platform-wide USD/VES
// rate used to price each business's subscription in /billing — subscriptions
// are always USD, so it always takes the USD leg. Vercel signs its own cron
// requests with `Authorization: Bearer $CRON_SECRET` once that env var is
// set on the project, which is what's checked below.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [usdRate, eurRate] = await Promise.allSettled([fetchBcvRate("USD"), fetchBcvRate("EUR")]);

  const businesses = await prisma.business.findMany({
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
    await prisma.business.update({
      where: { id: business.id },
      data: { exchangeRate: rateResult.value, exchangeRateUpdatedAt: new Date() },
    });
    updated++;
  }

  let platformUpdated = false;
  if (usdRate.status === "fulfilled") {
    await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: { id: PLATFORM_SETTINGS_ID, billingExchangeRate: usdRate.value },
      update: { billingExchangeRate: usdRate.value },
    });
    platformUpdated = true;
  }

  return NextResponse.json({
    ok: true,
    usdRate: usdRate.status === "fulfilled" ? usdRate.value : null,
    eurRate: eurRate.status === "fulfilled" ? eurRate.value : null,
    total: businesses.length,
    updated,
    skipped,
    platformUpdated,
  });
}
