"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { createBinancePayCheckout, getBinancePayOrderStatus, type BillingPlan } from "@/lib/actions/billing";
import { formatMoney } from "@/lib/format";

// Lets a business pay its maintenance fee with Binance Pay and get
// unblocked automatically — no proof-of-payment screenshot, no admin
// review. Once the order is created, this polls its status every few
// seconds; the webhook at app/api/webhooks/binance-pay/route.ts is what
// actually flips it to PAID as soon as Binance confirms the transfer.
export function BinancePayCheckout({ monthlyFeeUsdCents }: { monthlyFeeUsdCents: number | null }) {
  const router = useRouter();
  const [plan, setPlan] = useState<BillingPlan>("MONTHLY");
  const [state, setState] = useState<"idle" | "loading" | "open" | "paid" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state !== "open") return;
    const interval = setInterval(async () => {
      const orderId = orderIdRef.current;
      if (!orderId) return;
      const status = await getBinancePayOrderStatus(orderId);
      if (status === "PAID") {
        setState("paid");
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [state, router]);

  async function start() {
    setState("loading");
    setError(null);
    const result = await createBinancePayCheckout(plan);
    if (!result.success) {
      setError(result.error);
      setState("error");
      return;
    }
    orderIdRef.current = result.orderId;
    setCheckoutUrl(result.checkoutUrl);
    setQrDataUrl(await QRCode.toDataURL(result.checkoutUrl, { margin: 1, width: 220 }));
    setState("open");
  }

  if (state === "paid") {
    return <p className="text-sm text-success">Pago confirmado — tu suscripción ya quedó al día.</p>;
  }

  if (state === "open" && qrDataUrl) {
    return (
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Código QR de Binance Pay" className="rounded-md border border-border" />
        <a
          href={checkoutUrl!}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline underline-offset-2"
        >
          Abrir en Binance
        </a>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Escanea el código o abre el enlace desde la app de Binance. Se confirma solo apenas
          Binance recibe el pago — no necesitas hacer nada más aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {monthlyFeeUsdCents != null && (
        <div className="flex gap-1 rounded-lg border border-border p-1 w-fit">
          <button
            type="button"
            onClick={() => setPlan("MONTHLY")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              plan === "MONTHLY" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Mensual — {formatMoney(monthlyFeeUsdCents, "USD")}
          </button>
          <button
            type="button"
            onClick={() => setPlan("ANNUAL")}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              plan === "ANNUAL" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            Anual — {formatMoney(monthlyFeeUsdCents * 12, "USD")} (2 meses de regalo)
          </button>
        </div>
      )}
      <Button type="button" onClick={start} disabled={state === "loading"} className="w-fit">
        {state === "loading" ? "Generando..." : "Pagar con Binance Pay"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
