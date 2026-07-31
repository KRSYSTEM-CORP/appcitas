import { NextResponse, type NextRequest } from "next/server";
import { verifyBinancePayWebhookSignature } from "@/lib/binance-pay";
import { prisma } from "@/lib/prisma";
import { PLATFORM_SETTINGS_ID, monthsCoveredWithBonus, extendDueDateByMonths } from "@/lib/billing";

// Binance calls this after a checkout order (see
// createBinancePayCheckout in lib/actions/billing.ts) is actually paid —
// this is the ONLY step that marks a BinancePayOrder PAID and advances
// Business.nextPaymentDueDate; nothing here waits on a platform admin.
// Register this URL (https://<domain>/api/webhooks/binance-pay) in the
// Binance Merchant dashboard once BINANCE_PAY_API_KEY/SECRET_KEY are set.
const OK = { returnCode: "SUCCESS", returnMessage: null };
const FAIL = { returnCode: "FAIL", returnMessage: "signature verification failed" };

type BinancePayCallback = {
  bizType: string;
  bizStatus: string;
  data: string;
};

type BinancePayOrderData = {
  merchantTradeNo: string;
  transactTime?: number;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("BinancePay-Timestamp");
  const nonce = request.headers.get("BinancePay-Nonce");
  const signature = request.headers.get("BinancePay-Signature");

  if (!timestamp || !nonce || !signature) {
    return NextResponse.json(FAIL, { status: 400 });
  }
  if (!verifyBinancePayWebhookSignature(timestamp, nonce, rawBody, signature)) {
    return NextResponse.json(FAIL, { status: 400 });
  }

  const callback = JSON.parse(rawBody) as BinancePayCallback;
  if (callback.bizType !== "PAY" || callback.bizStatus !== "PAY_SUCCESS") {
    // Any other status (e.g. a cancel/refund notification) is acknowledged
    // without action — only a successful payment ever changes billing state.
    return NextResponse.json(OK);
  }

  const orderData = JSON.parse(callback.data) as BinancePayOrderData;

  const order = await prisma.binancePayOrder.findUnique({
    where: { merchantTradeNo: orderData.merchantTradeNo },
  });
  // Already processed (Binance retries webhooks) or an order we don't
  // recognize — either way, acknowledging without touching billing again
  // is the correct, idempotent response.
  if (order && order.status !== "PAID") {
    const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
    const business = await prisma.business.findUnique({ where: { id: order.businessId } });

    if (settings?.billingExchangeRate && business) {
      // order.amountUsdCents already reflects whatever plan (monthly or
      // annual) the checkout was created for — see createBinancePayCheckout
      // in lib/actions/billing.ts — so the months this order actually
      // covers, annual-prepay bonus included, is derived from the amount
      // itself rather than assumed to always be exactly one month.
      const months = business.monthlyFeeUsdCents
        ? monthsCoveredWithBonus(order.amountUsdCents, business.monthlyFeeUsdCents)
        : 1;
      const periodEnd = extendDueDateByMonths(business.nextPaymentDueDate, months || 1);

      await prisma.$transaction([
        prisma.payment.create({
          data: {
            businessId: order.businessId,
            amountUsdCents: order.amountUsdCents,
            exchangeRate: settings.billingExchangeRate,
            periodEnd,
            note: "Pago automático vía Binance Pay",
            verifiedById: "system:binance-pay-webhook",
          },
        }),
        prisma.business.update({ where: { id: order.businessId }, data: { nextPaymentDueDate: periodEnd } }),
        prisma.binancePayOrder.update({
          where: { id: order.id },
          data: { status: "PAID", paidAt: new Date() },
        }),
      ]);
    }
  }

  return NextResponse.json(OK);
}
