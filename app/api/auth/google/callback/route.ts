import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForProfile } from "@/lib/google-oauth";
import { setSessionCookie } from "@/lib/session";
import { sendSignupCodeEmail } from "@/lib/email";
import { createSignupVerification } from "@/lib/signup-verification";

// El otro extremo de /api/auth/google/start. Tres casos, en orden:
//
//  1. Ya existe un usuario con este googleId → es alguien que ya entró antes
//     por Google. Se firma sesión.
//  2. Existe un usuario con este correo pero sin googleId → se creó por
//     correo/clave. Se vincula la cuenta de Google a ese mismo usuario en vez
//     de crear un duplicado — es la misma persona con el mismo correo.
//  3. No existe nadie → alta completamente nueva: aunque Google ya confirmó
//     el correo, todavía se le pide el mismo código de 6 dígitos que el alta
//     por correo/clave (ver confirmSignupCode en lib/actions/auth.ts) antes
//     de crear el negocio/usuario — misma protección contra bots/spam para
//     ambos caminos de alta, no sólo el manual.

export const dynamic = "force-dynamic";

function redirectWithError(request: NextRequest, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete("google_oauth_state");
  return response;
}

// "Ana María Pérez" → { firstName: "Ana María", lastName: "Pérez" } — sólo
// se usa para poblar el alta nueva por Google; el owner puede corregirlo
// después. Sin apellido reconocible, todo el nombre queda en firstName.
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: fullName.trim(), lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const authCode = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("google_oauth_state")?.value;

  if (params.get("error")) {
    // El usuario canceló el consentimiento en la pantalla de Google — no es
    // un error del sistema, sólo se vuelve al login sin romper nada.
    return redirectWithError(request, "google_cancelado");
  }
  if (!authCode || !state || !expectedState || state !== expectedState) {
    return redirectWithError(request, "google_estado_invalido");
  }

  let profile: Awaited<ReturnType<typeof exchangeCodeForProfile>>;
  try {
    profile = await exchangeCodeForProfile(authCode);
  } catch (error) {
    console.error("[google oauth]", error);
    return redirectWithError(request, "google_fallo");
  }

  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.sub },
    include: { business: { select: { name: true } } },
  });

  const target =
    byGoogleId ??
    (await prisma.user.findFirst({
      where: { email: profile.email },
      include: { business: { select: { name: true } } },
    }));

  if (target) {
    if (target.status === "PENDING") return redirectWithError(request, "cuenta_pendiente");
    if (target.status === "SUSPENDED") return redirectWithError(request, "cuenta_suspendida");

    const user = target.googleId
      ? target
      : await prisma.user.update({
          where: { id: target.id },
          data: { googleId: profile.sub },
          include: { business: { select: { name: true } } },
        });

    await setSessionCookie({ uid: user.id, bid: user.businessId, businessName: user.business.name });
    const response = NextResponse.redirect(new URL(user.role === "OWNER" ? "/settings" : "/agenda", request.url));
    response.cookies.delete("google_oauth_state");
    return response;
  }

  // Alta nueva. El nombre del negocio se puede cambiar después desde
  // Configuración. El negocio/usuario todavía no se crean aquí — sólo al
  // confirmar el código (ver confirmSignupCode, lib/actions/auth.ts), igual
  // que el alta por correo/clave. subdomain queda sin definir a propósito:
  // createBusinessWithOwner genera uno a partir del nombre, como siempre
  // hizo para Google.
  const displayName = profile.name?.trim() || profile.email.split("@")[0];
  const { firstName, lastName } = splitName(displayName);
  const payload = {
    businessName: `Negocio de ${displayName}`,
    email: profile.email,
    googleId: profile.sub,
    firstName,
    lastName,
  };
  const { verificationId, code } = await createSignupVerification(profile.email, payload);
  await sendSignupCodeEmail(profile.email, code);

  const response = NextResponse.redirect(
    new URL(`/signup?vid=${verificationId}&email=${encodeURIComponent(profile.email)}`, request.url)
  );
  response.cookies.delete("google_oauth_state");
  return response;
}
