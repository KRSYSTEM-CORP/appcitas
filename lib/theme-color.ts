// Pure, isomorphic color math (no DOM/Node APIs) so the same derivation runs
// both server-side (app/layout.tsx, for the authenticated app shell) and
// client-side (components/auth/LoginForm.tsx, applied live as the visitor
// identifies their business before authenticating). A business only ever
// picks ONE background color, so the rest of the surface palette (card,
// muted, border, foreground) is derived from it — otherwise an arbitrary
// light or dark choice could pair with the wrong-contrast default
// text/border tokens.

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Mixes `hex` toward black/white by `amount` (0-1), used to derive
// surfaces (card/muted) a step lighter or darker than the chosen background.
function mixTowards(hex: string, target: "black" | "white", amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = target === "white" ? 255 : 0;
  const mixed = rgb.map((c) => Math.round(c + (t - c) * amount));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export type BrandVars = Partial<
  Record<
    | "--background"
    | "--foreground"
    | "--card"
    | "--card-foreground"
    | "--popover"
    | "--popover-foreground"
    | "--muted"
    | "--muted-foreground"
    | "--border"
    | "--input"
    | "--primary"
    | "--primary-foreground"
    | "--ring",
    string
  >
>;

// Builds a CSS custom-property override map from a business's chosen
// background/accent (either can be null, meaning "use the app default").
export function deriveBrandVars(background?: string | null, accent?: string | null): BrandVars {
  const vars: BrandVars = {};

  if (background && hexToRgb(background)) {
    const dark = relativeLuminance(background) < 0.5;
    vars["--background"] = background;
    vars["--foreground"] = dark ? "#f3ece7" : "#241a20";
    vars["--card"] = mixTowards(background, dark ? "white" : "black", dark ? 0.08 : 0.03);
    vars["--card-foreground"] = vars["--foreground"];
    vars["--popover"] = vars["--card"];
    vars["--popover-foreground"] = vars["--foreground"];
    vars["--muted"] = mixTowards(background, dark ? "white" : "black", dark ? 0.14 : 0.06);
    vars["--muted-foreground"] = dark ? "#b5a7af" : "#7a6b70";
    vars["--border"] = dark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)";
    vars["--input"] = dark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.12)";
  }

  if (accent && hexToRgb(accent)) {
    const dark = relativeLuminance(accent) < 0.5;
    vars["--primary"] = accent;
    vars["--primary-foreground"] = dark ? "#ffffff" : "#0b0b0b";
    vars["--ring"] = accent;
  }

  return vars;
}

// The full list of variable names deriveBrandVars can ever set — used
// client-side to clear a previous business's overrides back to the app
// default when the lookup returns nothing (e.g. the field was blanked).
export const BRAND_VAR_NAMES: (keyof BrandVars)[] = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--primary",
  "--primary-foreground",
  "--ring",
];
