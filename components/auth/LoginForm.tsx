"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, getBusinessBrandingByEmail, type BusinessBranding } from "@/lib/actions/auth";
import { deriveBrandVars, BRAND_VAR_NAMES } from "@/lib/theme-color";
import { GoogleIcon } from "@/components/auth/GoogleIcon";

const NO_BRANDING: BusinessBranding = { logoDataUrl: null, brandColor: null, brandBackground: null };

const GOOGLE_ERRORS: Record<string, string> = {
  google_no_configurado: "El inicio de sesión con Google no está configurado todavía.",
  google_cancelado: "Cancelaste el inicio de sesión con Google.",
  google_estado_invalido: "El enlace de Google expiró o no es válido. Intenta de nuevo.",
  google_fallo: "Google no pudo confirmar tu cuenta. Intenta de nuevo.",
  cuenta_pendiente: "Tu cuenta está pendiente de aprobación.",
  cuenta_suspendida: "Tu acceso está suspendido.",
};

export function LoginForm({
  googleConfigured = false,
  authError,
}: {
  googleConfigured?: boolean;
  authError?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState<BusinessBranding>(NO_BRANDING);
  const [isPending, startTransition] = useTransition();

  // Live-preview a business's own colors/logo on the login screen itself, as
  // soon as it's identified by email — before the visitor has authenticated.
  useEffect(() => {
    const vars = deriveBrandVars(branding.brandBackground, branding.brandColor);
    const root = document.documentElement.style;
    for (const name of BRAND_VAR_NAMES) {
      if (vars[name]) root.setProperty(name, vars[name]);
      else root.removeProperty(name);
    }
    return () => {
      for (const name of BRAND_VAR_NAMES) root.removeProperty(name);
    };
  }, [branding]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (!result.success) setError(result.error);
    });
  }

  async function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const email = e.target.value;
    if (!email) {
      setBranding(NO_BRANDING);
      return;
    }
    try {
      setBranding(await getBusinessBrandingByEmail(email));
    } catch {
      setBranding(NO_BRANDING);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto">
      {authError && GOOGLE_ERRORS[authError] && (
        <p className="text-sm text-destructive text-center">{GOOGLE_ERRORS[authError]}</p>
      )}

      {googleConfigured && (
        <>
          <a href="/api/auth/google/start" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <GoogleIcon />
            Continuar con Google
          </a>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4">
      {branding.logoDataUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.logoDataUrl} alt="" className="h-16 w-16 rounded object-cover" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" onBlur={handleEmailBlur} required />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input id="password" name="password" type="password" required />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? "Entrando..." : "Iniciar sesión"}
      </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Crea una
        </Link>
      </p>
    </div>
  );
}
