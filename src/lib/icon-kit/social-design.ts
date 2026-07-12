// Shared design system for the Social & Banner builder.
//
// Everything that both the render engine (canvas.ts) and the control panel
// (SocialPanel.tsx) need to agree on lives here — font pairings, texture
// presets, watermark placement, and the contrast math for the readability
// guardrail. One source of truth so a new font or texture is added in exactly
// one place, not pasted into two files.

// ── Fonts ───────────────────────────────────────────────────────────────────
// Borrowed from Palette Studio's pairing library (kept in sync intentionally —
// these are separate GitHub-Pages repos with no shared package, so the data is
// copied, not imported). Heading drives the brand name; body drives the
// eyebrow + tagline. `weights` is the exact set the canvas needs so we only
// fetch what we draw.

export type FontPair = {
  id: string;
  label: string;
  heading: string; // family name for the brand name
  body: string; // family name for eyebrow + tagline
  headingFamily: string; // full CSS stack
  bodyFamily: string; // full CSS stack
  googleHref: string;
  /** Weights actually drawn — [headingWeight, bodyWeight]. */
  headingWeight: number;
  bodyWeight: number;
};

export const FONT_PAIRS: FontPair[] = [
  {
    id: "inter",
    label: "Inter",
    heading: "Inter",
    body: "Inter",
    headingFamily: '"Inter", system-ui, sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleHref: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
    headingWeight: 800,
    bodyWeight: 500,
  },
  {
    id: "playfair-source",
    label: "Playfair Display / Source Sans",
    heading: "Playfair Display",
    body: "Source Sans 3",
    headingFamily: '"Playfair Display", serif',
    bodyFamily: '"Source Sans 3", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@400;600&display=swap",
    headingWeight: 800,
    bodyWeight: 600,
  },
  {
    id: "poppins-inter",
    label: "Poppins / Inter",
    heading: "Poppins",
    body: "Inter",
    headingFamily: '"Poppins", sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700&display=swap",
    headingWeight: 700,
    bodyWeight: 500,
  },
  {
    id: "space-inter",
    label: "Space Grotesk / Inter",
    heading: "Space Grotesk",
    body: "Inter",
    headingFamily: '"Space Grotesk", sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap",
    headingWeight: 700,
    bodyWeight: 500,
  },
  {
    id: "dmserif-dmsans",
    label: "DM Serif Display / DM Sans",
    heading: "DM Serif Display",
    body: "DM Sans",
    headingFamily: '"DM Serif Display", serif',
    bodyFamily: '"DM Sans", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap",
    headingWeight: 400, // DM Serif Display only ships one weight
    bodyWeight: 500,
  },
  {
    id: "fraunces-nunito",
    label: "Fraunces / Nunito Sans",
    heading: "Fraunces",
    body: "Nunito Sans",
    headingFamily: '"Fraunces", serif',
    bodyFamily: '"Nunito Sans", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Nunito+Sans:wght@400;600&display=swap",
    headingWeight: 700,
    bodyWeight: 600,
  },
  {
    id: "sora-inter",
    label: "Sora / Inter",
    heading: "Sora",
    body: "Inter",
    headingFamily: '"Sora", sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@600;700&display=swap",
    headingWeight: 700,
    bodyWeight: 500,
  },
  {
    id: "montserrat-opensans",
    label: "Montserrat / Open Sans",
    heading: "Montserrat",
    body: "Open Sans",
    headingFamily: '"Montserrat", sans-serif',
    bodyFamily: '"Open Sans", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600&display=swap",
    headingWeight: 800,
    bodyWeight: 600,
  },
  {
    id: "archivo-inter",
    label: "Archivo / Inter",
    heading: "Archivo",
    body: "Inter",
    headingFamily: '"Archivo", sans-serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600&display=swap",
    headingWeight: 800,
    bodyWeight: 500,
  },
  {
    id: "lora-inter",
    label: "Lora / Inter",
    heading: "Lora",
    body: "Inter",
    headingFamily: '"Lora", serif',
    bodyFamily: '"Inter", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lora:wght@600;700&display=swap",
    headingWeight: 700,
    bodyWeight: 500,
  },
];

export const DEFAULT_FONT_ID = "inter";

export function getFontPair(id: string): FontPair {
  return FONT_PAIRS.find((f) => f.id === id) ?? FONT_PAIRS[0];
}

// Load a font pairing into the document so the canvas can draw with it. Idempotent.
const loadedFonts = new Set<string>();
export function loadFontPair(pair: FontPair): void {
  if (typeof document === "undefined" || loadedFonts.has(pair.id)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = pair.googleHref;
  document.head.appendChild(link);
  loadedFonts.add(pair.id);
}

// Ensure the specific weights a render needs are actually rasterized before we
// draw to the canvas (a <link> loads async; drawing too early falls back to a
// system font and produces mismatched output between preview and export).
export async function ensureFontLoaded(pair: FontPair): Promise<void> {
  loadFontPair(pair);
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (typeof document === "undefined" || !fonts) return;
  const head = pair.heading.includes(" ") ? `"${pair.heading}"` : pair.heading;
  const body = pair.body.includes(" ") ? `"${pair.body}"` : pair.body;
  try {
    await Promise.all([
      fonts.load(`${pair.headingWeight} 64px ${head}`),
      fonts.load(`${pair.bodyWeight} 32px ${body}`),
      fonts.load(`600 24px ${body}`), // eyebrow weight
    ]);
  } catch {
    /* fall back to whatever's available */
  }
}

// ── Texture / shape layer ─────────────────────────────────────────────────────
// One tasteful geometric element, never a pile. Each is drawn very subtly (low
// alpha, tinted from the accent color) so it reads as intentional texture, not
// clip art. Restraint is the point.

export type TextureKind =
  | "none"
  | "corner-blob"
  | "diagonal"
  | "accent-rule"
  | "dot-grid"
  | "arc-lines"
  | "stripes"
  | "confetti"
  | "wave-band"
  | "grid-lines"
  | "halftone";

export interface TextureDef {
  id: TextureKind;
  label: string;
}

export const TEXTURES: TextureDef[] = [
  { id: "none", label: "None" },
  { id: "corner-blob", label: "Soft corner glow" },
  { id: "diagonal", label: "Diagonal block" },
  { id: "accent-rule", label: "Accent rule" },
  { id: "dot-grid", label: "Dot grid" },
  { id: "arc-lines", label: "Arc lines" },
  { id: "stripes", label: "Vertical stripes" },
  { id: "confetti", label: "Confetti" },
  { id: "wave-band", label: "Wave band" },
  { id: "grid-lines", label: "Blueprint grid" },
  { id: "halftone", label: "Halftone dots" },
];

// ── Highlight styles ──────────────────────────────────────────────────────────
// How a spotlighted run of words is emphasized. "bold" is the default — it just
// recolors + bolds the words inline, so it never collides with neighboring text
// (the marker block's weakness). The others are opt-in flavors.
export type HighlightStyle = "bold" | "underline" | "marker" | "glow";

export interface HighlightStyleDef {
  id: HighlightStyle;
  label: string;
}

export const HIGHLIGHT_STYLES: HighlightStyleDef[] = [
  { id: "bold", label: "Bold color" },
  { id: "underline", label: "Underline" },
  { id: "marker", label: "Marker block" },
  { id: "glow", label: "Glow" },
];

// ── Watermark ─────────────────────────────────────────────────────────────────
export type WatermarkEdge = "right" | "left" | "bottom-right" | "bottom-left";

export interface WatermarkDef {
  id: WatermarkEdge;
  label: string;
}

export const WATERMARK_EDGES: WatermarkDef[] = [
  { id: "right", label: "Right edge" },
  { id: "left", label: "Left edge" },
  { id: "bottom-right", label: "Bottom-right" },
  { id: "bottom-left", label: "Bottom-left" },
];

// ── Contrast (WCAG) ───────────────────────────────────────────────────────────
// The readability guardrail: compute contrast ratio between the text color and
// the dominant background color, warn below the AA-large threshold (3:1), and
// offer an auto-flipped text color (black or white, whichever wins).

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6); // ignore alpha for luminance
  const n = parseInt(h || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a));
  const lb = relLuminance(hexToRgb(b));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Mix two hex colors 50/50 — used to approximate a gradient's "average" bg. */
export function mixHex(a: string, b: string): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const m = (x: number, y: number) => Math.round((x + y) / 2);
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(m(ca.r, cb.r))}${to(m(ca.g, cb.g))}${to(m(ca.b, cb.b))}`;
}

/** The best readable text color (black or white) against a background hex. */
export function readableTextColor(bg: string): string {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#000000", bg) ? "#ffffff" : "#000000";
}

// AA large-text threshold. Banner/headline text is large, so 3:1 is the correct
// bar (not 4.5:1, which is for body copy).
export const CONTRAST_MIN = 3;

// Per-platform avatar-safe fraction (bottom-left round avatar + breathing room).
// Shared so both the renderer and the preview overlay draw the SAME guide.
export const AVATAR_SAFE: Record<"linkedin" | "facebook" | "twitter", number> = {
  linkedin: 0.14,
  facebook: 0.22,
  twitter: 0.16,
};
