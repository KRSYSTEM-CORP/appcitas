"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestSignupCode, confirmSignupCode, resendSignupCode } from "@/lib/actions/auth";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { Turnstile } from "@/components/auth/Turnstile";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";

const GOOGLE_ERRORS: Record<string, string> = {
  google_no_configurado: "El inicio de sesión con Google no está configurado todavía.",
  google_cancelado: "Cancelaste el inicio de sesión con Google.",
  google_estado_invalido: "El enlace de Google expiró o no es válido. Intenta de nuevo.",
  google_fallo: "Google no pudo confirmar tu cuenta. Intenta de nuevo.",
  google_turnstile_fallido: "No pudimos verificar que eres humano. Intenta de nuevo.",
  cuenta_pendiente: "Tu cuenta está pendiente de aprobación.",
  cuenta_suspendida: "Tu acceso está suspendido.",
};

const RESEND_COOLDOWN_S = 30;

function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        name="acceptedTerms"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span>
        Acepto los{" "}
        <Link href="/terminos" target="_blank" className="text-foreground underline underline-offset-4">
          Términos y Condiciones
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" target="_blank" className="text-foreground underline underline-offset-4">
          Política de Privacidad
        </Link>
        .
      </span>
    </label>
  );
}

export function SignupForm({
  googleConfigured,
  authError,
  initialVerificationId,
  initialEmail,
}: {
  googleConfigured: boolean;
  authError?: string;
  initialVerificationId?: string;
  initialEmail?: string;
}) {
  // A brand-new Google signup (app/api/auth/google/callback) lands back here
  // with vid/email already in the URL, skipping straight to the code step —
  // it never went through the manual form below, so the terms checkbox that
  // step would have shown gets rendered on the code step instead.
  const viaGoogle = Boolean(initialVerificationId);
  const [step, setStep] = useState<"form" | "code">(viaGoogle ? "code" : "form");
  const [error, setError] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(initialVerificationId ?? null);
  const [pendingEmail, setPendingEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();

  function tickResendCooldown() {
    setResendCooldown(RESEND_COOLDOWN_S);
    const interval = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function handleRequestCode(formData: FormData) {
    setError(null);
    if (formData.get("acceptedTerms") !== "on") {
      setError("Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.");
      return;
    }
    startTransition(async () => {
      const result = await requestSignupCode(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setVerificationId(result.verificationId);
      setPendingEmail(result.email);
      setStep("code");
      tickResendCooldown();
    });
  }

  function handleConfirmCode() {
    if (!verificationId) return;
    if (viaGoogle && !acceptedTerms) {
      setError("Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await confirmSignupCode(verificationId, code, viaGoogle ? acceptedTerms : true);
      if (!result.success) setError(result.error);
    });
  }

  function handleResend() {
    if (!verificationId || resendCooldown > 0) return;
    setError(null);
    startTransition(async () => {
      const result = await resendSignupCode(verificationId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      tickResendCooldown();
    });
  }

  function handleGoogleClick() {
    if (!turnstileToken && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      setError("Resuelve la verificación de seguridad para continuar.");
      return;
    }
    const url = new URL("/api/auth/google/start", window.location.origin);
    url.searchParams.set("from", "signup");
    if (turnstileToken) url.searchParams.set("token", turnstileToken);
    window.location.href = url.toString();
  }

  if (step === "code") {
    return (
      <div className="flex flex-col gap-4 max-w-sm mx-auto">
        <div>
          <h2 className="text-lg font-semibold">Confirma tu correo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enviamos un código de 6 dígitos a <span className="font-medium text-foreground">{pendingEmail}</span>.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Código de verificación</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-lg tracking-[0.5em] tabular-nums"
          />
        </div>

        {viaGoogle && <TermsCheckbox checked={acceptedTerms} onChange={setAcceptedTerms} />}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          disabled={isPending || code.length !== 6 || (viaGoogle && !acceptedTerms)}
          size="lg"
          onClick={handleConfirmCode}
        >
          {isPending ? "Verificando..." : "Confirmar código"}
        </Button>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button
            type="button"
            className="underline underline-offset-4 disabled:no-underline disabled:opacity-50"
            disabled={resendCooldown > 0 || isPending}
            onClick={handleResend}
          >
            {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : "Reenviar código"}
          </button>
          {!viaGoogle && (
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => {
                setStep("form");
                setError(null);
                setCode("");
              }}
            >
              Cambiar datos
            </button>
          )}
        </div>
      </div>
    );
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
              partir del nombre. Igual pasa por el mismo Turnstile de abajo
              y, si es alta nueva, por el mismo paso de código que el
              formulario manual (ver app/api/auth/google/callback/route.ts). */}
          <button
            type="button"
            onClick={handleGoogleClick}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            <GoogleIcon />
            Crear negocio con Google
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={handleRequestCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessName">Nombre del negocio</Label>
          <Input id="businessName" name="businessName" required />
          <p className="text-xs text-muted-foreground">Ej. Salón Bella Vista</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="subdomain">Subdominio</Label>
          <Input
            id="subdomain"
            name="subdomain"
            pattern="[a-z0-9-]+"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Ej. bella-vista — tu página de reservas: /book/{subdomain || "bella-vista"}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordRequirements password={password} />
        </div>

        <Turnstile onVerify={setTurnstileToken} />

        <TermsCheckbox checked={acceptedTerms} onChange={setAcceptedTerms} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={isPending || !acceptedTerms} size="lg">
          {isPending ? "Enviando código..." : "Crear negocio"}
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
