"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Bump the suffix (v1 -> v2) if the content changes enough that returning
// users should see it again — otherwise this only ever shows once per
// browser, the first time someone lands on the login screen.
const DISMISS_KEY = "kr-citas-welcome-dismissed-v1";

const STEPS = [
  "Crea tu cuenta con el nombre y subdominio de tu negocio.",
  "Configura tus servicios, especialistas y horario de atención.",
  "Comparte tu página pública de reservas con tus clientes.",
  "Gestiona tus citas, pagos y clientes desde la Agenda.",
];

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(DISMISS_KEY)) setOpen(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-lg ring-1 ring-foreground/10">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-5" />
        </button>

        <h2 className="text-lg font-semibold mb-2">¿Qué es KR Citas?</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Agenda y reservas para negocios de servicios — control de citas, clientes,
          especialistas y pagos, con una página pública de reservas para tu negocio.
        </p>

        <p className="text-sm font-medium mb-2">Para empezar:</p>
        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <Button className="mt-5 w-full" onClick={dismiss}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
