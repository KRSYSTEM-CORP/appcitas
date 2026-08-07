"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/lib/actions/auth";
import { GoogleIcon } from "@/components/auth/GoogleIcon";

const GOOGLE_ERRORS: Record<string, string> = {
  google_no_configurado: "El inicio de sesión con Google no está configurado todavía.",
  google_cancelado: "Cancelaste el inicio de sesión con Google.",
  google_estado_invalido: "El enlace de Google expiró o no es válido. Intenta de nuevo.",
  google_fallo: "Google no pudo confirmar tu cuenta. Intenta de nuevo.",
  cuenta_pendiente: "Tu cuenta está pendiente de aprobación.",
  cuenta_suspendida: "Tu acceso está suspendido.",
};

export function SignupForm({ googleConfigured, authError }: { googleConfigured: boolean; authError?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm mx-auto">
      {authError && GOOGLE_ERRORS[authError] && (
        <p className="text-sm text-destructive text-center">{GOOGLE_ERRORS[authError]}</p>
      )}

      {googleConfigured && (
        <>
          {/* Con Google no hace falta pedir nombre de negocio, subdominio ni
              clave: el negocio se crea solo, con un subdominio generado a
              partir del nombre — todo ajustable después desde Configuración.
              Es justo lo que hace que el alta sea "de un clic". */}
          <a href="/api/auth/google/start" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <GoogleIcon />
            Crear negocio con Google
          </a>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessName">Nombre del negocio</Label>
          <Input id="businessName" name="businessName" placeholder="Salón Bella Vista" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subdomain">Subdominio</Label>
          <Input
            id="subdomain"
            name="subdomain"
            placeholder="bella-vista"
            pattern="[a-z0-9-]+"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Tu página de reservas: /book/{subdomain || "tu-subdominio"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={isPending} size="lg">
          {isPending ? "Creando negocio..." : "Crear negocio"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground text-center">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
