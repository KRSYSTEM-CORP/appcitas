import { z } from "zod";
import { CURRENCIES } from "@/lib/currencies";

const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

export const SubdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Debe tener al menos 2 caracteres")
  .max(30, "No puede tener más de 30 caracteres")
  .regex(SUBDOMAIN_REGEX, "Solo minúsculas, números y guiones (no al inicio ni al final)");

export const SignupSchema = z.object({
  businessName: z.string().trim().min(1, "El nombre del negocio es obligatorio"),
  subdomain: SubdomainSchema,
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
});

export const AnnouncementSchema = z.object({
  subject: z.string().trim().min(1, "El asunto es obligatorio"),
  message: z.string().trim().min(1, "El mensaje es obligatorio"),
});

export const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const BrandingSchema = z.object({
  businessName: z.string().trim().min(1, "El nombre del negocio es obligatorio"),
  logoDataUrl: z.string().trim().optional().or(z.literal("")),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .optional()
    .or(z.literal("")),
  brandBackground: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .optional()
    .or(z.literal("")),
});

const WeekdayHourSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    isClosed: z.boolean(),
    // Closed days round-trip from Prisma as null, not "" or undefined.
    opensAt: z.string().trim().nullable().optional(),
    closesAt: z.string().trim().nullable().optional(),
    // Optional single break (e.g. lunch) — both null/empty means no break.
    breakStart: z.string().trim().nullable().optional(),
    breakEnd: z.string().trim().nullable().optional(),
  })
  .refine((h) => (h.breakStart ? !!h.breakEnd : !h.breakEnd), {
    message: "Indica inicio y fin del descanso, o deja ambos vacíos",
    path: ["breakEnd"],
  })
  .refine((h) => !h.breakStart || !h.breakEnd || h.breakStart < h.breakEnd, {
    message: "El descanso debe empezar antes de terminar",
    path: ["breakEnd"],
  })
  .refine(
    (h) =>
      h.isClosed ||
      !h.breakStart ||
      !h.breakEnd ||
      !h.opensAt ||
      !h.closesAt ||
      (h.breakStart >= h.opensAt && h.breakEnd <= h.closesAt),
    { message: "El descanso debe estar dentro del horario de atención", path: ["breakStart"] },
  );

export const BusinessHoursSchema = z.object({
  hours: z.array(WeekdayHourSchema).length(7, "Debe incluir los 7 días de la semana"),
});

export const ServiceHoursSchema = z.object({
  hasCustomHours: z.boolean(),
  hours: z.array(WeekdayHourSchema).length(7, "Debe incluir los 7 días de la semana"),
});

export const ServiceSchema = z.object({
  name: z.string().trim().min(1, "El nombre del servicio es obligatorio"),
  description: z.string().trim().optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(5, "Debe durar al menos 5 minutos").max(600, "Máximo 600 minutos"),
  basePrice: z.coerce.number().min(0, "El precio no puede ser negativo"),
  priceCurrencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Usa un código de 3 letras (ej. USD)"),
  category: z.string().trim().optional().or(z.literal("")),
});

export const SpecialistSchema = z.object({
  displayName: z.string().trim().min(1, "El nombre es obligatorio"),
  bio: z.string().trim().optional().or(z.literal("")),
  serviceIds: z.array(z.string()).default([]),
});

export const ClientSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio"),
  lastName: z.string().trim().min(1, "El apellido es obligatorio"),
  phone: z.string().trim().min(4, "El teléfono es obligatorio"),
  email: z.string().trim().toLowerCase().email("Correo inválido").optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export const CurrencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Usa un código de 3 letras (ej. USD)");

// Split to mirror the ventas-inventario app's structure: enabling FX +
// picking the reference currency is one form/action, the numeric rate is a
// separate one, and the local retail currency is a third.
export const ReferenceCurrencySettingsSchema = z.object({
  fxEnabled: z.boolean(),
  foreignCurrencyCode: CurrencyCodeSchema,
});

export const ExchangeRateSchema = z.object({
  rate: z.coerce.number().positive("La tasa debe ser mayor a 0"),
});

export const LocalCurrencySchema = z.object({
  localCurrencyCode: z
    .string()
    .trim()
    .refine((v) => CURRENCIES.some((c) => c.code === v), "Moneda no reconocida"),
});

export const PaymentMethodSchema = z.enum(["CASH", "TRANSFER", "CARD", "PAGO_MOVIL", "BINANCE", "OTHER"]);

export const PAYMENT_METHODS_REQUIRING_REFERENCE = ["TRANSFER", "CARD", "PAGO_MOVIL", "BINANCE"] as const;

// Binance is always settled in the business's foreign/reference currency —
// there's no "pay Binance in bolívares" option, so its row never shows the
// local/foreign toggle (see components/agenda/PaymentForm).
export const USD_ALWAYS_METHODS = ["BINANCE"] as const;

export const PaymentCurrencySchema = z.enum(["LOCAL", "FOREIGN"]);

export const PaymentSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency: PaymentCurrencySchema,
  paymentMethod: PaymentMethodSchema,
  reference: z.string().trim().optional().or(z.literal("")),
});

// Platform subscription billing (see lib/billing.ts, lib/actions/billing.ts,
// lib/actions/admin.ts) — separate from the retail PaymentSchema above,
// which is for what a business charges ITS OWN clients.
const toCents = (v: number) => Math.round(v * 100);
const blankToUndefined = (v: unknown) => (v === "" || v == null ? undefined : v);

export const MaintenancePaymentSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0").transform(toCents),
  periodEnd: z.coerce.date(),
  note: z.preprocess(blankToUndefined, z.string().trim().optional()),
});

export type MaintenancePaymentInput = z.infer<typeof MaintenancePaymentSchema>;

const PaymentReportLineSchema = z.object({
  paymentMethod: PaymentMethodSchema,
  amount: z.coerce.number().positive("El monto debe ser mayor a 0").transform(toCents),
  reference: z.preprocess(blankToUndefined, z.string().trim().optional()),
});

export const PaymentReportSchema = z
  .object({
    lines: z.array(PaymentReportLineSchema),
    proofImageDataUrl: z
      .string()
      .trim()
      .min(1, "El comprobante de pago es obligatorio")
      .refine((v) => v.startsWith("data:image/"), "Comprobante inválido")
      .refine((v) => v.length < 3_000_000, "El comprobante es demasiado grande"),
    note: z.preprocess(blankToUndefined, z.string().trim().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.lines.length === 0) {
      ctx.addIssue({ code: "custom", path: ["lines"], message: "Agrega al menos un método de pago" });
      return;
    }
    data.lines.forEach((line, i) => {
      if (
        (PAYMENT_METHODS_REQUIRING_REFERENCE as readonly string[]).includes(line.paymentMethod) &&
        !line.reference
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["lines", i, "reference"],
          message: "El número de referencia es obligatorio para este método de pago",
        });
      }
    });
  });

export type PaymentReportInput = z.infer<typeof PaymentReportSchema>;

export const RejectPaymentReportSchema = z.object({
  reviewNote: z.preprocess(blankToUndefined, z.string().trim().optional()),
});

export const PlatformSettingsSchema = z.object({
  paymentInstructions: z.preprocess(blankToUndefined, z.string().trim().optional()),
  billingExchangeRate: z.coerce.number().positive("La tasa debe ser mayor a 0").optional(),
  defaultMonthlyFee: z.preprocess(
    blankToUndefined,
    z.coerce.number().positive("El monto debe ser mayor a 0").transform(toCents).optional()
  ),
});
