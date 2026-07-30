"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/lib/actions/auth";

export function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (result.success) setSubmitted(true);
      else setError(result.error);
    });
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-3 max-w-sm mx-auto text-center">
        <h2 className="text-lg font-semibold">Negocio creado</h2>
        <p className="text-sm text-muted-foreground">
          Tu cuenta está pendiente de aprobación. Te avisaremos cuando puedas iniciar sesión.
        </p>
        <Link href="/login" className="text-sm text-foreground underline underline-offset-4">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto">
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

      <p className="text-sm text-muted-foreground text-center">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
