import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBanescoPagoMovilEmail, monthsCoveredWithBonus, extendDueDateByMonths } from "@/lib/billing";

// Receives the plain-text body of a Banesco "Pago Móvil" notification
// email, forwarded by a Cloudflare Email Worker (see the deployment
// instructions given to the platform admin) after the business's own inbox
// auto-forwards Banesco's notifications to a dedicated capture address.
// There's no bank API to call here — this route IS the "confirmation" step,
// the same role app/api/webhooks/binance-pay/route.ts plays for that rail.
// Protected by a shared secret (BANESCO_EMAIL_WEBHOOK_SECRET) rather than a
// cryptographic signature, since we don't control the sender (a Worker we
// wrote ourselves) the way a real payment processor would sign its calls.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.BANESCO_EMAIL_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("x-webhook-secret") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.text) {
    return NextResponse.json({ ok: false, error: "missing text" }, { status: 400 });
  }

  const parsed = parseBanescoPagoMovilEmail(body.text);
  if (!parsed) {
    // Not a payment-notification email we recognize (or Banesco changed the
    // wording) — acknowledged without action so the Worker doesn't retry.
    return NextResponse.json({ ok: true, matched: false });
  }

  const order = await prisma.pagoMovilOrder.findFirst({
    where: { expectedAmountBsCents: parsed.amountBsCents, status: "PENDING", expiresAt: { gt: new Date() } },
  });
  if (!order) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const business = await prisma.business.findUnique({
    where: { id: order.businessId },
    select: { monthlyFeeUsdCents: true, nextPaymentDueDate: true },
  });
  if (!business) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const months = business.monthlyFeeUsdCents
    ? monthsCoveredWithBonus(order.amountUsdCents, business.monthlyFeeUsdCents)
    : 1;
  const periodEnd = extendDueDateByMonths(business.nextPaymentDueDate, months || 1);

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        businessId: order.businessId,
        amountUsdCents: order.amountUsdCents,
        exchangeRate: order.exchangeRate,
        periodEnd,
        note: `Pago automático vía Pago Móvil (Banesco)${parsed.reference ? ` — REF:${parsed.reference}` : ""}`,
        verifiedById: "system:banesco-email-webhook",
      },
    }),
    prisma.business.update({ where: { id: order.businessId }, data: { nextPaymentDueDate: periodEnd } }),
    prisma.pagoMovilOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true, matched: true });
}
