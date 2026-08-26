"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { withTenant } from "@/lib/tenant-db";
import { requireSession } from "@/lib/session";
import { PaymentSchema, USD_ALWAYS_METHODS } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";
import type { PaymentMethod, Prisma } from "@prisma/client";

export type PaymentLineInput = {
  amount: number;
  currency: "LOCAL" | "FOREIGN";
  paymentMethod: PaymentMethod;
  reference?: string;
};

// A single payment can be split across several methods/currencies in one
// go — e.g. $10 cash + the rest in VES Pago Móvil — rather than requiring
// the owner to save one line, reopen the form, and save another. Every line
// becomes its own Transaction row; validated up front so a bad line fails
// before anything is written, then all created together in one transaction.
export async function recordPayments(
  target: { appointmentId: string } | { packageId: string },
  lines: PaymentLineInput[],
): Promise<ActionResult> {
  const { businessId } = await requireSession();

  if (lines.length === 0) return { success: false, error: "Agrega al menos un pago" };

  const parsedLines: z.infer<typeof PaymentSchema>[] = [];
  for (const line of lines) {
    const parsed = PaymentSchema.safeParse(line);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const isUsdAlwaysMethod = (USD_ALWAYS_METHODS as readonly string[]).includes(parsed.data.paymentMethod);
    if (isUsdAlwaysMethod && parsed.data.currency !== "FOREIGN") {
      return { success: false, error: "Este método siempre se cobra en la moneda de referencia (USD)" };
    }
    parsedLines.push(parsed.data);
  }

  const result = await withTenant(businessId, async (tx) => {
    const targetExists =
      "appointmentId" in target
        ? await tx.appointment.findFirst({ where: { id: target.appointmentId, businessId } })
        : await tx.sessionPackage.findFirst({ where: { id: target.packageId, businessId } });
    if (!targetExists) {
      return { error: "appointmentId" in target ? "Cita no encontrada" : "Paquete no encontrado" };
    }

    const business = await tx.business.findUniqueOrThrow({ where: { id: businessId } });

    const rate = business.exchangeRate != null ? Number(business.exchangeRate) : null;
    const useFx = business.fxEnabled && rate != null && rate > 0;

    if (parsedLines.some((l) => l.currency === "FOREIGN") && !useFx) {
      return { error: "Configura la moneda de referencia y una tasa de cambio en Configuración antes de cobrar en divisas" };
    }

    const data: Prisma.TransactionCreateManyInput[] = parsedLines.map((line) => {
      const enteredCents = Math.round(line.amount * 100);
      // rate is local-per-foreign-unit (e.g. 1 USD = 40 VES), and cents cancel
      // consistently on both sides of the conversion.
      const amountLocalCents = line.currency === "LOCAL" ? enteredCents : Math.round(enteredCents * rate!);
      const amountForeignCents =
        line.currency === "FOREIGN" ? enteredCents : useFx ? Math.round(enteredCents / rate!) : null;

      return {
        ...("appointmentId" in target ? { appointmentId: target.appointmentId } : { packageId: target.packageId }),
        amountLocalCents,
        amountForeignCents,
        paidCurrencyCode: line.currency === "LOCAL" ? business.localCurrencyCode : business.foreignCurrencyCode,
        currencyLocal: business.localCurrencyCode,
        currencyForeign: useFx ? business.foreignCurrencyCode : null,
        fxRate: useFx ? rate : null,
        paymentMethod: line.paymentMethod,
        reference: line.reference || null,
      };
    });

    await tx.transaction.createMany({ data });
    return { error: null };
  });
  if (result.error) return { success: false, error: result.error };

  revalidatePath("/agenda");
  revalidatePath("/packages");
  return { success: true };
}
