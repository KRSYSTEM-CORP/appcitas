import { PAYMENT_METHOD_LABELS, formatDate, formatMoney, formatTime } from "@/lib/format";
import type { PaymentMethod } from "@prisma/client";

export type ReceiptData = {
  transactionId: string;
  businessName: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  specialistName: string;
  // e.g. "Sesión 2/6" for a package session, or "Paquete de 6 sesiones" for
  // a whole-package payment — null for a plain one-off appointment.
  sessionLabel: string | null;
  paidAt: Date;
  amountLocalCents: number;
  amountForeignCents: number | null;
  paidCurrencyCode: string;
  currencyLocal: string;
  currencyForeign: string | null;
  paymentMethod: PaymentMethod;
  reference: string | null;
};

// No sequential counter field on Transaction (unlike ventas-inventario's
// receiptControlNumber) — this mirrors that app's own fallback format for
// documents without an assigned number, which is good enough for a receipt
// that only needs to look up one specific payment, not be gapless.
export function receiptControlNumber(transactionId: string): string {
  return transactionId.slice(-8).toUpperCase();
}

export function buildReceiptLines(data: ReceiptData): string[] {
  const paidForeign = data.paidCurrencyCode === data.currencyForeign;
  const primaryCents = paidForeign ? data.amountForeignCents! : data.amountLocalCents;
  const primaryCurrency = paidForeign ? data.currencyForeign! : data.currencyLocal;
  const secondaryCents = paidForeign ? data.amountLocalCents : data.amountForeignCents;
  const secondaryCurrency = paidForeign ? data.currencyLocal : data.currencyForeign;
  const total =
    formatMoney(primaryCents, primaryCurrency) +
    (secondaryCents != null && secondaryCurrency ? ` (${formatMoney(secondaryCents, secondaryCurrency)})` : "");

  const lines = [
    "RECIBO DE PAGO",
    `Nº de control: ${receiptControlNumber(data.transactionId)}`,
    `Fecha: ${formatDate(data.paidAt)} ${formatTime(data.paidAt)}`,
    "",
    `Negocio: ${data.businessName}`,
    `Cliente: ${data.clientName}`,
    `Teléfono: ${data.clientPhone}`,
    "",
    `Servicio: ${data.serviceName}${data.sessionLabel ? ` (${data.sessionLabel})` : ""}`,
    `Especialista: ${data.specialistName}`,
    "",
    `Método de pago: ${PAYMENT_METHOD_LABELS[data.paymentMethod]}`,
  ];
  if (data.reference) lines.push(`Referencia: ${data.reference}`);
  lines.push("", `TOTAL PAGADO: ${total}`);
  return lines;
}

export function buildReceiptText(data: ReceiptData): string {
  return buildReceiptLines(data).join("\n");
}

// Sends the receipt itself as the WhatsApp message text (not a link to a
// hosted document, unlike ventas-inventario's ShareDialog) — this app has
// no PDF-hosting infrastructure, and the request was specifically for a
// plain-text ticket. No country-code normalization, matching the same
// digit-strip convention used by buildWhatsAppReminderLink.
export function buildWhatsAppReceiptLink(phone: string, data: ReceiptData): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(buildReceiptText(data))}`;
}
