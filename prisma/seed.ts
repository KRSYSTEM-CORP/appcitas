import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Creates the platform super admin the first time this runs — safe to
// re-run (skips if the account already exists). This is the only way an
// isSuperAdmin account gets created; there's no in-app flow for it.
async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD not set — skipping super admin seed.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin ${email} already exists — skipping.`);
    return;
  }

  const business = await prisma.business.create({
    data: {
      name: "KR System — Administración",
      subdomain: "kyra-citas-admin",
      loginCode: "ADMIN0",
    },
  });

  await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      businessId: business.id,
      firstName: "Super",
      lastName: "Admin",
      role: "OWNER",
      status: "ACTIVE",
      isSuperAdmin: true,
    },
  });

  console.log(`Super admin created: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
