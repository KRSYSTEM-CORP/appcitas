"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { ServiceSchema } from "@/lib/validations";
import { bulkImportServices, type BulkServiceResult } from "@/lib/actions/services";

const HEADER_MAP: Record<string, string> = {
  nombre: "name",
  name: "name",
  categoria: "category",
  category: "category",
  "duracion (min)": "durationMinutes",
  duracion: "durationMinutes",
  durationminutes: "durationMinutes",
  precio: "basePrice",
  price: "basePrice",
  baseprice: "basePrice",
  moneda: "priceCurrencyCode",
  currency: "priceCurrencyCode",
  pricecurrencycode: "priceCurrencyCode",
  descripcion: "description",
  description: "description",
};

function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

type ParsedRow = {
  row: number;
  name?: unknown;
  category?: unknown;
  durationMinutes?: unknown;
  basePrice?: unknown;
  priceCurrencyCode?: unknown;
  description?: unknown;
  error: string | null;
};

export function ImportServicesForm({ defaultCurrencyCode }: { defaultCurrencyCode: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkServiceResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function parseWorkbook(buffer: ArrayBuffer): ParsedRow[] {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

    return raw.map((rawRow, index) => {
      const mapped: Record<string, unknown> = { priceCurrencyCode: defaultCurrencyCode };
      for (const [key, value] of Object.entries(rawRow)) {
        const canonical = HEADER_MAP[normalizeHeader(key)];
        if (canonical && value !== "") mapped[canonical] = value;
      }
      const parsed = ServiceSchema.safeParse(mapped);
      return {
        row: index + 2,
        ...mapped,
        error: parsed.success ? null : (parsed.error.issues[0]?.message ?? "Datos inválidos"),
      };
    });
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nombre", "Categoría", "Duración (min)", "Precio", "Moneda", "Descripción"],
      ["Corte de cabello", "Cabello", 45, 15, defaultCurrencyCode, "Corte y lavado"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Servicios");
    XLSX.writeFile(wb, "plantilla-servicios.xlsx");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileError(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer);
      if (parsed.length === 0) {
        setFileError("El archivo no tiene filas de servicios.");
        setRows([]);
        return;
      }
      setRows(parsed);
    } catch {
      setFileError("No se pudo leer el archivo. Verifica que sea un Excel válido (.xlsx).");
      setRows([]);
    }
  }

  const validRows = rows.filter((r) => !r.error);
  const invalidRows = rows.filter((r) => r.error);

  function confirmImport() {
    startTransition(async () => {
      const res = await bulkImportServices(
        validRows.map((r) => ({
          name: r.name,
          category: r.category,
          durationMinutes: r.durationMinutes,
          basePrice: r.basePrice,
          priceCurrencyCode: r.priceCurrencyCode,
        })),
      );
      setResult(res);
      setRows([]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex flex-col gap-1.5 rounded-md border border-border p-4">
        <p className="text-sm text-muted-foreground">
          Sube un Excel (.xlsx) con tus servicios. Columnas esperadas:{" "}
          <strong>Nombre, Categoría, Duración (min), Precio, Moneda, Descripción</strong> (Nombre,
          Duración y Precio son obligatorios; Moneda usa {defaultCurrencyCode} si la dejas en
          blanco). Si el nombre ya existe en tu catálogo, ese servicio se actualiza en vez de
          duplicarse — sirve tanto para importar servicios nuevos como para actualizar los que ya
          tienes.
        </p>
        <div className="flex gap-2 mt-2">
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            Descargar plantilla
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          <Button type="button" onClick={() => fileInputRef.current?.click()}>
            Seleccionar archivo
          </Button>
        </div>
        {fileError && <p className="text-sm text-destructive mt-2">{fileError}</p>}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm">
              {validRows.length} servicio{validRows.length === 1 ? "" : "s"} listo
              {validRows.length === 1 ? "" : "s"} para guardar
              {invalidRows.length > 0 && (
                <span className="text-destructive"> · {invalidRows.length} con errores (no se guardarán)</span>
              )}
            </p>
            <Button type="button" disabled={validRows.length === 0 || isPending} onClick={confirmImport}>
              {isPending ? "Guardando..." : "Confirmar"}
            </Button>
          </div>
          <div className="rounded-md border border-border overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">Fila</th>
                  <th className="px-3 py-1.5 font-medium">Nombre</th>
                  <th className="px-3 py-1.5 font-medium">Duración</th>
                  <th className="px-3 py-1.5 font-medium">Precio</th>
                  <th className="px-3 py-1.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} className={`border-b border-border last:border-0 ${r.error ? "opacity-70" : ""}`}>
                    <td className="px-3 py-1.5">{r.row}</td>
                    <td className="px-3 py-1.5">{String(r.name ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.durationMinutes ?? "—")}</td>
                    <td className="px-3 py-1.5">
                      {String(r.basePrice ?? "—")} {String(r.priceCurrencyCode ?? "")}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.error ? (
                        <span className="text-destructive">{r.error}</span>
                      ) : (
                        <span className="text-success">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-md border border-border p-4 flex flex-col gap-1">
          <p className="text-sm">
            <strong>{result.created}</strong> servicio{result.created === 1 ? "" : "s"} creado
            {result.created === 1 ? "" : "s"}, <strong>{result.updated}</strong> actualizado
            {result.updated === 1 ? "" : "s"}.
          </p>
          {result.failed.length > 0 && (
            <p className="text-sm text-destructive">
              {result.failed.length} fila{result.failed.length === 1 ? "" : "s"} con errores:{" "}
              {result.failed.map((f) => `#${f.row} (${f.error})`).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
