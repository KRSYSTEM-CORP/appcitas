import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { googleAuthUrl, googleOAuthConfigured } from "@/lib/google-oauth";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getClientIp } from "@/lib/request-ip";

// Punto de entrada de "Continuar con Google". El state va en una cookie
// httpOnly de corta vida y, al volver, el callback exige que el parámetro
// `state` de la URL coincida con ella — es la defensa estándar contra que
// alguien arme un enlace de callback falso y lo mande a otra persona.
//
// El botón de Google en LoginForm/SignupForm sólo navega aquí después de
// resolver el mismo widget de Turnstile que ya protegía el formulario
// manual (ver components/auth/Turnstile.tsx) — así el filtro anti-bot cubre
// también el camino de Google, no sólo el correo/clave.

export const dynamic = "force-dynamic";

function redirectToOrigin(request: NextRequest, error: string) {
  const from = request.nextUrl.searchParams.get("from") === "signup" ? "signup" : "login";
  const url = new URL(`/${from}`, request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!googleOAuthConfigured()) {
    return redirectToOrigin(request, "google_no_configurado");
  }

  const turnstileToken = request.nextUrl.searchParams.get("token") ?? "";
  const ip = await getClientIp();
  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return redirectToOrigin(request, "google_turnstile_fallido");
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
