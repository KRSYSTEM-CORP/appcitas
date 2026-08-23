"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBranding } from "@/lib/actions/business";
import { resizeImageToDataUrl } from "@/lib/image-utils";

const MAX_DIMENSION = 160;

export function BrandingForm({
  currentName,
  currentLogo,
  currentColor,
  currentBackground,
}: {
  currentName: string;
  currentLogo: string | null;
  currentColor: string | null;
  currentBackground: string | null;
}) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState(currentName);
  const [logoDataUrl, setLogoDataUrl] = useState(currentLogo ?? "");
  const [brandColor, setBrandColor] = useState(currentColor ?? "#a8355a");
  const [brandBackground, setBrandBackground] = useState(currentBackground ?? "#fbf6f4");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, { maxDimension: MAX_DIMENSION, format: "image/png" });
      setLogoDataUrl(dataUrl);
    } catch {
      setError("No se pudo procesar la imagen. Intenta con otro archivo.");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    formData.set("businessName", businessName);
    formData.set("logoDataUrl", logoDataUrl);
    formData.set("brandColor", brandColor);
    formData.set("brandBackground", brandBackground);
    startTransition(async () => {
      const result = await updateBranding(formData);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="businessNameInput">Nombre del negocio</Label>
        <Input
          id="businessNameInput"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          className="max-w-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Logo</Label>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="Logo" className="h-12 w-12 shrink-0 rounded object-cover border border-border" />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded border border-border flex items-center justify-center text-xs text-muted-foreground">
              Sin logo
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-sm min-w-0 max-w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brandColorInput">Color de acento (botones, enlaces)</Label>
          <div className="flex items-center gap-3">
            <input
              id="brandColorInput"
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-14 rounded border border-border cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{brandColor}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brandBackgroundInput">Color de fondo</Label>
          <div className="flex items-center gap-3">
            <input
              id="brandBackgroundInput"
              type="color"
              value={brandBackground}
              onChange={(e) => setBrandBackground(e.target.value)}
              className="h-9 w-14 rounded border border-border cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">{brandBackground}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        El resto de los colores (tarjetas, bordes, texto) se ajustan automáticamente para que se
        sigan viendo bien, sea un fondo claro u oscuro.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-success">Personalización guardada</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar personalización"}
      </Button>
    </form>
  );
}
