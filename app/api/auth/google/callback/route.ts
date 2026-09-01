import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForProfile } from "@/lib/google-oauth";
import { setSessionCookie } from "@/lib/session";
import { createBusinessWithOwner } from "@/lib/business-provisioning";

// El otro extremo de /api/auth/google/start. Tres casos, en orden:
//
//  1. Ya existe un usuario con este googleId → es alguien que ya entró antes
//     por Google. Se firma sesión.
//  2. Existe un usuario con este correo pero sin googleId → se creó por
//     correo/clave. Se vincula la cuenta de Google a ese mismo usuario en vez
//     de crear un duplicado — es la misma persona con el mismo correo.
//  3. No existe nadie → alta completamente nueva: se crea el negocio (con su
//     horario por defecto y un subdominio generado a partir del nombre) y el
//     usuario OWNER en el mismo gesto, sin pedir contraseña ni nada más. Esto
//     es lo que hace que el registro sea "completamente automatizado" (ver
//     createBusinessWithOwner).

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
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("google_oauth_state")?.value;

  if (params.get("error")) {
    // El usuario canceló el consentimiento en la pantalla de Google — no es
    // un error del sistema, sólo se vuelve al login sin romper nada.
    return redirectWithError(request, "google_cancelado");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(request, "google_estado_invalido");
  }

  let profile: Awaited<ReturnType<typeof exchangeCodeForProfile>>;
  try {
    profile = await exchangeCodeForProfile(code);
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
  // Configuración — lo que importa aquí es no interponer un formulario más
  // entre el clic en "Continuar con Google" y quedar adentro.
  const displayName = profile.name?.trim() || profile.email.split("@")[0];
  const { firstName, lastName } = splitName(displayName);
  const { business, user } = await createBusinessWithOwner(`Negocio de ${displayName}`, {
    email: profile.email,
    firstName,
    lastName,
    googleId: profile.sub,
  });

  await setSessionCookie({ uid: user.id, bid: business.id, businessName: business.name });
  const response = NextResponse.redirect(new URL("/agenda", request.url));
  response.cookies.delete("google_oauth_state");
  return response;
}
