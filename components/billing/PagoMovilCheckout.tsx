"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPagoMovilOrder, getPagoMovilOrderStatus, type BillingPlan } from "@/lib/actions/billing";

// Lets a business pay its maintenance fee via Pago Móvil (Banesco) and get
// unblocked automatically, without a proof-of-payment screenshot or admin
// review — the closest Bs equivalent to BinancePayCheckout. There's no bank
// API to create a real "checkout": instead this reserves a specific amount
// (the real fee plus a few random bolívar cents) and asks the business to
// transfer exactly that. app/api/webhooks/banesco-email/route.ts is what
// actually flips the order to PAID, once a forwarded bank notification
// email matches the reserved amount — this just polls for that.
export function PagoMovilCheckout({ paymentInstructions }: { paymentInstructions: string | null }) {
  const router = useRouter();
  const [plan, setPlan] = useState<BillingPlan>("MONTHLY");
  const [state, setState] = useState<"idle" | "loading" | "open" | "paid" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [amountBs, setAmountBs] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state !== "open") return;
    const interval = setInterval(async () => {
      const orderId = orderIdRef.current;
      if (!orderId) return;
      const status = await getPagoMovilOrderStatus(orderId);
      if (status === "PAID") {
        setState("paid");
        router.refresh();
      } else if (status === "EXPIRED") {
        setError("La solicitud expiró sin recibir el pago. Genera una nueva.");
        setState("error");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state, router]);

  async function start() {
    setState("loading");
    setError(null);
    const result = await createPagoMovilOrder(plan);
    if (!result.success) {
      setError(result.error);
      setState("error");
      return;
    }
    orderIdRef.current = result.orderId;
    setAmountBs(result.amountBs);
    setExpiresAt(new Date(result.expiresAt));
    setState("open");
  }

  if (state === "paid") {
    return <p className="text-sm text-success">Pago confirmado — tu suscripción ya quedó al día.</p>;
  }

  if (state === "open" && amountBs) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">
            Transfiere exactamente este monto
          </span>
          <span className="text-2xl font-semibold tabular-nums">Bs. {amountBs}</span>
          <p className="text-xs text-muted-foreground">
            El monto tiene que coincidir exacto (con los centavos) para que se detecte solo — no
            redondees.
          </p>
        </div>
        {paymentInstructions && (
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Datos de Pago Móvil</p>
            <p className="text-sm whitespace-pre-line">{paymentInstructions}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Se confirma solo apenas llega la notificación del banco — no necesitas hacer nada más
          aquí.
          {expiresAt && ` Esta solicitud vence a las ${expiresAt.toLocaleTimeString("es-VE")}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          type="button"
          onClick={() => setPlan("MONTHLY")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            plan === "MONTHLY" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          Mensual
        </button>
        <button
          type="button"
          onClick={() => setPlan("ANNUAL")}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            plan === "ANNUAL" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          Anual (2 meses de regalo)
        </button>
      </div>
      <Button type="button" onClick={start} disabled={state === "loading"} className="w-fit">
        {state === "loading" ? "Generando..." : "Pagar con Pago Móvil"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
