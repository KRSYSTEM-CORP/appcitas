// Client-side only: resizes an image file to fit within maxDimension and
// returns it as a data URL, so large phone photos (logos) don't blow past
// the server action body size limit.
export function resizeImageToDataUrl(
  file: File,
  options: { maxDimension: number; format?: "image/png" | "image/jpeg"; quality?: number }
): Promise<string> {
  const { maxDimension, format = "image/png", quality } = options;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo procesar la imagen"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(format, quality));
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
