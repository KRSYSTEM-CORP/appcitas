import "server-only";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withSuperAdmin } from "@/lib/tenant-db";
import { PLATFORM_SETTINGS_ID, TRIAL_DAYS, FALLBACK_MONTHLY_FEE_USD_CENTS } from "@/lib/billing";

// Alta de un negocio nuevo con su horario por defecto y su dueño (OWNER). La
// usan tanto el signup por correo/clave (lib/actions/auth.ts) como el
// callback de Google (app/api/auth/google/callback/route.ts) — es el mismo
// negocio con el mismo trial sin importar cómo entró el dueño. El alta es
// autoservicio (sin aprobación de un super admin): el trial de TRIAL_DAYS
// días arranca aquí mismo, no en un paso de aprobación aparte.

// Excludes visually ambiguous characters (0/O, 1/I) since staff will be
// reading this off a screen or a note to type it in themselves.
const LOGIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateLoginCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += LOGIN_CODE_ALPHABET[randomInt(LOGIN_CODE_ALPHABET.length)];
  }
  return code;
}

// Matches SubdomainSchema in lib/validations.ts: lowercase letters/digits/
// hyphens, 2-30 chars, never starting or ending with a hyphen.
function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return base.length >= 2 ? base : `negocio-${randomInt(1000, 9999)}`;
}

async function uniqueSubdomainFor(businessName: string): Promise<string> {
  let subdomain = slugify(businessName);
  while (await prisma.business.findUnique({ where: { subdomain } })) {
    subdomain = slugify(`${businessName}-${Math.random().toString(36).slice(2, 6)}`);
  }
  return subdomain;
}

export type NewOwner = {
  email: string;
  firstName: string;
  lastName: string;
  passwordHash?: string;
  googleId?: string;
};

// subdomain is optional: the email/password signup form collects and
// validates one explicitly (see lib/actions/auth.ts), while the Google
// signup path (no form step at all) has createBusinessWithOwner generate one
// from businessName instead.
export async function createBusinessWithOwner(businessName: string, owner: NewOwner, subdomain?: string) {
  const resolvedSubdomain = subdomain ?? (await uniqueSubdomainFor(businessName));
  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Creating a business's default BusinessHour rows needs the RLS escape
      // hatch: the tenant_isolation policy requires app.business_id to
      // already match, but there's no existing business to scope into yet.
      return await withSuperAdmin(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: businessName,
            subdomain: resolvedSubdomain,
            loginCode: generateLoginCode(),
            monthlyFeeUsdCents: settings?.defaultMonthlyFeeUsdCents ?? FALLBACK_MONTHLY_FEE_USD_CENTS,
            nextPaymentDueDate: trialEnd,
            // Sensible salon-style default: Mon-Fri 9-18, Sat 9-13, Sun closed.
            // The owner adjusts these from Settings once signed in.
            businessHours: {
              create: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
                weekday,
                isClosed: weekday === 0,
                opensAt: weekday === 0 ? null : "09:00",
                closesAt: weekday === 0 ? null : weekday === 6 ? "13:00" : "18:00",
              })),
            },
          },
        });
        const user = await tx.user.create({
          data: {
            email: owner.email,
            passwordHash: owner.passwordHash,
            googleId: owner.googleId,
            // True either way by this point: Google already confirmed the
            // address, and the email/password path only reaches here after
            // confirmSignupCode() verifies the emailed code (lib/actions/auth.ts).
            emailVerified: true,
            hasSeenTour: false,
            // Only ever called from confirmSignupCode() (lib/actions/auth.ts),
            // which already required acceptedTerms === true before reaching
            // here — for both the email/password and Google paths.
            termsAcceptedAt: new Date(),
            businessId: business.id,
            firstName: owner.firstName,
            lastName: owner.lastName,
            role: "OWNER",
            status: "ACTIVE",
          },
        });
        return { business, user };
      });
    } catch (err) {
      const isLoginCodeCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("loginCode");
      if (!isLoginCodeCollision) throw err;
    }
  }

  throw new Error("No se pudo crear el negocio, intenta de nuevo");
}
