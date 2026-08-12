"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, requireOwner } from "@/lib/session";
import {
  BrandingSchema,
  BusinessHoursSchema,
  ExchangeRateSchema,
  LocalCurrencySchema,
  ReferenceCurrencySettingsSchema,
} from "@/lib/validations";
import { fetchBcvRate } from "@/lib/bcv-rate";
import { DEFAULT_CURRENCY_CODE } from "@/lib/currencies";
import type { ActionResult } from "@/lib/types";

export type BusinessBrandingOnly = {
  logoDataUrl: string | null;
  brandColor: string | null;
  brandBackground: string | null;
};

const NO_BRANDING: BusinessBrandingOnly = { logoDataUrl: null, brandColor: null, brandBackground: null };

// Used by the authenticated app shell (app/layout.tsx) — any signed-in role,
// not just the owner, needs the business's branding to render the nav bar.
export async function getBranding(): Promise<BusinessBrandingOnly> {
  const session = await getSession();
  if (!session) return NO_BRANDING;

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { logoDataUrl: true, brandColor: true, brandBackground: true },
  });
  if (!business) return NO_BRANDING;

  return business;
}

export type BusinessConfig = {
  name: string;
  subdomain: string;
  loginCode: string;
  logoDataUrl: string | null;
  brandColor: string | null;
  brandBackground: string | null;
  localCurrencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  currentRate: number | null;
  currentRateUpdatedAt: Date | null;
  hours: {
    weekday: number;
    isClosed: boolean;
    opensAt: string | null;
    closesAt: string | null;
    breakStart: string | null;
    breakEnd: string | null;
  }[];
};

export async function getBusinessConfig(): Promise<BusinessConfig> {
  const { businessId } = await requireOwner();

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    include: { businessHours: { orderBy: { weekday: "asc" } } },
  });

  return {
    name: business.name,
    subdomain: business.subdomain,
    loginCode: business.loginCode,
    logoDataUrl: business.logoDataUrl,
    brandColor: business.brandColor,
    brandBackground: business.brandBackground,
    localCurrencyCode: business.localCurrencyCode,
    fxEnabled: business.fxEnabled,
    foreignCurrencyCode: business.foreignCurrencyCode,
    currentRate: business.exchangeRate != null ? Number(business.exchangeRate) : null,
    currentRateUpdatedAt: business.exchangeRateUpdatedAt,
    hours: business.businessHours.map((h) => ({
      weekday: h.weekday,
      isClosed: h.isClosed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
      breakStart: h.breakStart,
      breakEnd: h.breakEnd,
    })),
  };
}

export type FxInfo = {
  fxEnabled: boolean;
  localCurrencyCode: string;
  foreignCurrencyCode: string;
  rate: number | null;
};

// The daily Vercel cron (app/api/cron/bcv-rate/route.ts) is the primary way
// this refreshes, but Vercel's own scheduler has occasionally failed to fire
// it without any app-level cause (seen on the sibling ventas-inventario
// project). As a self-healing backstop, any read of the rate for a VES
// business also refreshes it here if it's gone stale — so the rate corrects
// itself the next time someone opens the app, regardless of whether the
// cron actually ran that day.
const STALE_RATE_MS = 20 * 60 * 60 * 1000;

// Lightweight lookup for any signed-in role — the payment form needs this
// without pulling the full owner-only business config.
export async function getFxInfo(): Promise<FxInfo> {
  const session = await getSession();
  if (!session) return { fxEnabled: false, localCurrencyCode: "USD", foreignCurrencyCode: "USD", rate: null };

  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: {
      fxEnabled: true,
      localCurrencyCode: true,
      foreignCurrencyCode: true,
      exchangeRate: true,
      exchangeRateUpdatedAt: true,
    },
  });

  let rate = business?.exchangeRate != null ? Number(business.exchangeRate) : null;

  const isStale =
    business?.localCurrencyCode === "VES" &&
    business.fxEnabled &&
    (business.exchangeRateUpdatedAt == null ||
      Date.now() - business.exchangeRateUpdatedAt.getTime() > STALE_RATE_MS);

  if (isStale && business) {
    try {
      const freshRate = await fetchBcvRate(business.foreignCurrencyCode as "USD" | "EUR");
      await prisma.business.update({
        where: { id: session.businessId },
        data: { exchangeRate: freshRate, exchangeRateUpdatedAt: new Date() },
      });
      rate = freshRate;
    } catch {
      // Keep serving the last known rate; the next page load or the cron retries.
    }
  }

  return {
    fxEnabled: business?.fxEnabled ?? false,
    localCurrencyCode: business?.localCurrencyCode ?? "USD",
    foreignCurrencyCode: business?.foreignCurrencyCode ?? "USD",
    rate,
  };
}

export type DayHours = {
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  breakStart: string | null;
  breakEnd: string | null;
};

// Session-agnostic (any role, not just OWNER) so the agenda's day timeline —
// visible to specialists too — can read the day's open/close/break window
// without going through the owner-only getBusinessConfig.
export async function getBusinessHourForWeekday(weekday: number): Promise<DayHours | null> {
  const session = await getSession();
  if (!session) return null;

  const hour = await prisma.businessHour.findUnique({
    where: { businessId_weekday: { businessId: session.businessId, weekday } },
    select: { isClosed: true, opensAt: true, closesAt: true, breakStart: true, breakEnd: true },
  });
  return hour ?? { isClosed: true, opensAt: null, closesAt: null, breakStart: null, breakEnd: null };
}

// Enable/disable FX display + pick the reference currency (EUR/USD) — split
// from the numeric rate itself, mirroring the ventas-inventario app's
// ReferenceCurrencyForm/updateReferenceCurrencySettings.
export async function updateReferenceCurrencySettings(input: {
  fxEnabled: boolean;
  foreignCurrencyCode: string;
}): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = ReferenceCurrencySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { fxEnabled: parsed.data.fxEnabled, foreignCurrencyCode: parsed.data.foreignCurrencyCode },
  });

  revalidatePath("/settings", "layout");
  revalidatePath("/agenda");
  revalidatePath("/services");
  revalidatePath("/packages");
  revalidatePath("/reports");
  return { success: true };
}

// The business's local retail currency — decoupled from the reference
// currency prices are stored in, same split as ventas-inventario's
// CurrencySelectForm/updateLocalCurrency.
export async function updateLocalCurrency(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = LocalCurrencySchema.safeParse({ localCurrencyCode: formData.get("localCurrencyCode") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Moneda inválida" };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { localCurrencyCode: parsed.data.localCurrencyCode },
  });

  revalidatePath("/settings", "layout");
  revalidatePath("/agenda");
  revalidatePath("/services");
  revalidatePath("/packages");
  revalidatePath("/reports");
  return { success: true };
}

// Manual numeric entry/override for the exchange rate.
export async function updateExchangeRate(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = ExchangeRateSchema.safeParse({ rate: formData.get("rate") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Tasa inválida" };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { exchangeRate: parsed.data.rate, exchangeRateUpdatedAt: new Date() },
  });

  revalidatePath("/settings", "layout");
  revalidatePath("/agenda");
  revalidatePath("/packages");
  revalidatePath("/reports");
  return { success: true };
}

// Pulls today's official BCV rate for the given reference currency (USD or
// EUR) and stores it as the business's current rate — the same thing the
// daily cron (app/api/cron/bcv-rate/route.ts) does automatically, just on
// demand. Only meaningful for VES businesses, since BCV publishes bolívar
// rates. Takes the currency explicitly from the caller (the form's current
// selection) rather than reading business.foreignCurrencyCode — that DB
// value only updates once the reference-currency form is actually saved, so
// reading it here would silently fetch the OLD currency's rate whenever the
// owner switches USD/EUR and clicks this button before saving.
export type BcvRateResult = { success: true; rate: number } | { success: false; error: string };

export async function fetchAndUpdateBcvRate(currency: string): Promise<BcvRateResult> {
  const { businessId } = await requireOwner();

  if (currency !== "USD" && currency !== "EUR") {
    return { success: false, error: "Elige USD o EUR como moneda de referencia para usar la tasa BCV" };
  }

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { localCurrencyCode: true },
  });
  if (business.localCurrencyCode !== "VES") {
    return { success: false, error: "La tasa del BCV solo aplica para bolívares (VES)" };
  }

  let rate: number;
  try {
    rate = await fetchBcvRate(currency);
  } catch {
    return { success: false, error: "No se pudo consultar la tasa del BCV. Intenta de nuevo." };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { fxEnabled: true, foreignCurrencyCode: currency, exchangeRate: rate, exchangeRateUpdatedAt: new Date() },
  });

  revalidatePath("/settings", "layout");
  revalidatePath("/agenda");
  revalidatePath("/packages");
  revalidatePath("/reports");
  return { success: true, rate };
}

// Lightweight lookup for any signed-in role (not owner-gated) — used
// wherever prices need formatting (services list, agenda) without pulling
// the full owner-only business config.
export async function getBusinessCurrency(): Promise<string> {
  const session = await getSession();
  if (!session) return DEFAULT_CURRENCY_CODE;
  const business = await prisma.business.findUnique({
    where: { id: session.businessId },
    select: { localCurrencyCode: true },
  });
  return business?.localCurrencyCode ?? DEFAULT_CURRENCY_CODE;
}

export async function updateBranding(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = BrandingSchema.safeParse({
    businessName: formData.get("businessName"),
    logoDataUrl: formData.get("logoDataUrl") || undefined,
    brandColor: formData.get("brandColor") || undefined,
    brandBackground: formData.get("brandBackground") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      name: parsed.data.businessName,
      logoDataUrl: parsed.data.logoDataUrl || null,
      brandColor: parsed.data.brandColor || null,
      brandBackground: parsed.data.brandBackground || null,
    },
  });

  revalidatePath("/settings", "layout");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateBusinessHours(hours: BusinessConfig["hours"]): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = BusinessHoursSchema.safeParse({ hours });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Horario inválido" };
  }

  await prisma.$transaction(
    parsed.data.hours.map((h) =>
      prisma.businessHour.update({
        where: { businessId_weekday: { businessId, weekday: h.weekday } },
        data: {
          isClosed: h.isClosed,
          opensAt: h.isClosed ? null : h.opensAt || null,
          closesAt: h.isClosed ? null : h.closesAt || null,
          breakStart: h.isClosed ? null : h.breakStart || null,
          breakEnd: h.isClosed ? null : h.breakEnd || null,
        },
      }),
    ),
  );

  revalidatePath("/settings", "layout");
  return { success: true };
}
