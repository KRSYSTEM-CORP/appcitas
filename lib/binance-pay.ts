import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

// Binance Pay Merchant API client — used to automate the maintenance-fee
// subscription for businesses who'd rather pay this way than submit a
// manual PaymentReport screenshot (see app/api/webhooks/binance-pay/route.ts
// for the other half: the webhook that confirms payment and advances
// billing automatically, no admin review involved).
//
// Requires real merchant credentials from https://merchant.binance.com —
// without BINANCE_PAY_API_KEY/BINANCE_PAY_SECRET_KEY set, createOrder()
// throws and the calling action surfaces a clear "not configured" error
// instead of the app crashing or silently doing nothing.
const API_BASE = "https://bpay.binanceapi.com";

function requireCredentials(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.BINANCE_PAY_API_KEY;
  const secretKey = process.env.BINANCE_PAY_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error("BINANCE_PAY_NOT_CONFIGURED");
  }
  return { apiKey, secretKey };
}

function sign(secretKey: string, timestamp: string, nonce: string, body: string): string {
  const payload = `${timestamp}\n${nonce}\n${body}\n`;
  return createHmac("sha512", secretKey).update(payload).digest("hex").toUpperCase();
}

export type BinancePayOrderResult = {
  prepayId: string;
  checkoutUrl: string;
  qrcodeLink: string;
};

// Creates a one-time Binance Pay checkout order for a maintenance-fee
// payment. merchantTradeNo must be unique per attempt (see
// createBinancePayCheckout in lib/actions/billing.ts, which generates it
// from the business id + timestamp) — Binance uses it as their own
// idempotency key, and the webhook echoes it back so we know which
// BinancePayOrder row to mark PAID.
export async function createBinancePayOrder(params: {
  merchantTradeNo: string;
  amountUsdCents: number;
  description: string;
}): Promise<BinancePayOrderResult> {
  const { apiKey, secretKey } = requireCredentials();
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString("hex");
  const body = JSON.stringify({
    env: { terminalType: "WEB" },
    merchantTradeNo: params.merchantTradeNo,
    orderAmount: (params.amountUsdCents / 100).toFixed(2),
    currency: "USDT",
    goods: {
      goodsType: "02",
      goodsCategory: "Z000",
      referenceGoodsId: params.merchantTradeNo,
      goodsName: params.description,
    },
  });

  const res = await fetch(`${API_BASE}/binancepay/openapi/v3/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "BinancePay-Timestamp": timestamp,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": apiKey,
      "BinancePay-Signature": sign(secretKey, timestamp, nonce, body),
    },
    body,
  });

  const json = await res.json();
  if (json.status !== "SUCCESS") {
    throw new Error(json.errorMessage ?? "No se pudo crear la orden de Binance Pay");
  }

  return {
    prepayId: json.data.prepayId,
    checkoutUrl: json.data.checkoutUrl,
    qrcodeLink: json.data.qrcodeLink,
  };
}

// Verifies a webhook callback actually came from Binance before trusting its
// contents — recomputes the same HMAC the request-signing side uses (this
// API is symmetric: the merchant secret signs both directions) and compares
// it to the BinancePay-Signature header with a timing-safe check.
export function verifyBinancePayWebhookSignature(
  timestamp: string,
  nonce: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  const secretKey = process.env.BINANCE_PAY_SECRET_KEY;
  if (!secretKey) return false;

  const expected = sign(secretKey, timestamp, nonce, rawBody);
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
