"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, getBusinessBrandingByEmail, type BusinessBranding } from "@/lib/actions/auth";
import { deriveBrandVars, BRAND_VAR_NAMES } from "@/lib/theme-color";

const NO_BRANDING: BusinessBranding = { logoDataUrl: null, brandColor: null, brandBackground: null };

export function LoginForm() {
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
    <form action={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto">
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
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" required />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? "Entrando..." : "Iniciar sesión"}
      </Button>

      <p className="text-sm text-muted-foreground text-center">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Crea una
        </Link>
      </p>
    </form>
  );
}
