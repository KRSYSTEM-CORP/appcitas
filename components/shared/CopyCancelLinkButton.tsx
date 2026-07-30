"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

// Surfaces the same /cancel/[token] link the client sees on the public
// booking confirmation screen and inside the WhatsApp reminder text — but
// as a direct copy action, so it's reachable even when the appointment was
// created by the owner (Agenda "Nueva cita" or a package) instead of by the
// client booking themselves, and even when the owner isn't messaging via
// WhatsApp at all (SMS, phone call, in person).
export function CopyCancelLinkButton({ cancelToken }: { cancelToken: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/cancel/${cancelToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar enlace para cancelar"
      className="opacity-70 hover:opacity-100 shrink-0"
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
    </button>
  );
}
