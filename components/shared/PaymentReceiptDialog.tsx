"use client";

import { useState } from "react";
import { Check, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildReceiptLines, buildWhatsAppReceiptLink, receiptControlNumber, type ReceiptData } from "@/lib/receipt";

// Opens a printable/shareable ticket for a single Transaction — the request
// was "al reportar un pago crea un ticket ... que también pueda ser enviado
// en formato de texto a través de whatsapp". Scoped per-payment (not per
// whole sale like ventas-inventario's Recibo de Pago) since this app's unit
// of payment is one Transaction against an appointment or package, never a
// multi-item sale — see lib/receipt.ts.
export function PaymentReceiptDialog({ data }: { data: ReceiptData }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = buildReceiptLines(data);
  const whatsappLink = buildWhatsAppReceiptLink(data.clientPhone, data);

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) return;
    const html = lines
      .map((line) => (line === "" ? "<br/>" : `<div>${escapeHtml(line)}</div>`))
      .join("\n");
    printWindow.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Recibo ${receiptControlNumber(data.transactionId)}</title>
<style>
  body { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; padding: 16px; white-space: pre-wrap; }
</style>
</head>
<body>${html}</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function handleCopy() {
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver recibo"
        className="opacity-70 hover:opacity-100 shrink-0 inline-flex items-center"
      >
        <Receipt className="size-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-border bg-card p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed border border-dashed border-border rounded-md p-3">
              {lines.join("\n")}
            </pre>

            <div className="flex flex-wrap gap-2">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <Button type="button" size="sm">
                  Enviar por WhatsApp
                </Button>
              </a>
              <Button type="button" size="sm" variant="outline" onClick={handlePrint}>
                Imprimir
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="size-3.5" /> Copiado
                  </span>
                ) : (
                  "Copiar texto"
                )}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
