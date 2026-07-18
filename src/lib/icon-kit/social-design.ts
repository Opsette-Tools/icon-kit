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

import {
  FONT_PAIRINGS,
  cssFamily,
  googleHref,
  pairingLabel,
  heaviestWeight,
  lightestWeight,
  getPairing,
  type FontPairing,
} from "@/lib/shared-fonts";

// Re-export the library's heading-first pairing API so the panel can offer a
// "choose a heading → suggest a body" picker straight from this module.
export {
  suggestBodyFonts,
  defaultBodyFor,
  HEADING_FONTS,
  type BodySuggestion,
  type HeadingOption,
} from "@/lib/shared-fonts";

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

// Adapt a shared-library pairing to Icon Kit's FontPair shape. The heading is
// drawn at its heaviest declared weight (brand name wants weight); the body at
// its lightest (comfortable eyebrow/tagline). The eyebrow is always drawn at
// 600 by the canvas, independent of these.
function toFontPair(p: FontPairing): FontPair {
  return {
    id: p.id,
    label: pairingLabel(p),
    heading: p.heading.family,
    body: p.body.family,
    headingFamily: cssFamily(p.heading),
    bodyFamily: cssFamily(p.body),
    googleHref: googleHref(p),
    headingWeight: heaviestWeight(p.heading),
    bodyWeight: lightestWeight(p.body),
  };
}

export const FONT_PAIRS: FontPair[] = FONT_PAIRINGS.map(toFontPair);

export const DEFAULT_FONT_ID = "inter";

export function getFontPair(id: string): FontPair {
  return toFontPair(getPairing(id));
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
//
// Content-awareness contract (see TEXTURE_CONTENT_AWARE_PLAN.md): the texture
// pass receives the bounding boxes the content will occupy (logo + text). A
// texture declares `respectsContent`:
//   • true  → HARD-EDGED (rules, brackets, dot fields, frames). Must AVOID the
//     reserved zone — it anchors to a free region so it never slices the logo
//     or text. The renderer picks the free anchor from the reserved boxes.
//   • false → AMBIENT/DIFFUSE (radial glows, soft washes). May overlap the
//     content; it reads as depth, not as a shape hitting the brand.
// New textures are built content-aware from day one — no more fixed top-left
// rules blind to where the logo lands.

export type TextureKind =
  | "none"
  // ambient — overlaps content freely (reads as depth)
  | "corner-glow"
  | "mesh"
  | "spotlight"
  | "wave-band"
  | "noise-dots"
  | "soft-rays"
  // hard-edged — anchored to a free region, avoids the reserved zone
  | "accent-rule"
  | "edge-rule"
  | "corner-bracket"
  | "frame";

export interface TextureDef {
  id: TextureKind;
  label: string;
  /** Hard-edged textures (true) avoid the content footprint; ambient (false) may overlap. */
  respectsContent: boolean;
}

export const TEXTURES: TextureDef[] = [
  { id: "none", label: "None", respectsContent: false },
  // Ambient washes — safe on restrained brands, never collide.
  { id: "corner-glow", label: "Corner glow", respectsContent: false },
  { id: "mesh", label: "Soft mesh", respectsContent: false },
  { id: "spotlight", label: "Spotlight", respectsContent: false },
  { id: "wave-band", label: "Wave band", respectsContent: false },
  { id: "soft-rays", label: "Soft rays", respectsContent: false },
  { id: "noise-dots", label: "Fine grain", respectsContent: false },
  // Hard-edged accents — anchored to whatever space the content leaves free.
  { id: "accent-rule", label: "Accent rule (top-left)", respectsContent: true },
  { id: "edge-rule", label: "Edge rule (free side)", respectsContent: true },
  { id: "corner-bracket", label: "Corner bracket", respectsContent: true },
  { id: "frame", label: "Keyline frame", respectsContent: true },
];

/** Whether a texture must avoid the content footprint (hard-edged) or may overlap. */
export function textureRespectsContent(kind: TextureKind): boolean {
  return TEXTURES.find((t) => t.id === kind)?.respectsContent ?? false;
}

// Old texture ids that were renamed or retired in the content-aware refactor.
// A saved design (localStorage draft or exported blob) may still carry one; map
// it to the closest current texture so reopening never lands on a blank/broken
// texture. Retired kinds fall back to the nearest surviving relative.
const LEGACY_TEXTURE_MAP: Record<string, TextureKind> = {
  // Original catalog (pre content-aware refactor).
  "corner-blob": "corner-glow", // renamed
  "dot-grid": "corner-bracket", // retired → nearest surviving hard-edged accent
  diagonal: "corner-glow", // retired → ambient wash
  "arc-lines": "corner-glow", // retired → ambient wash
  stripes: "corner-bracket", // retired → nearest structured accent
  confetti: "corner-glow", // retired → ambient wash
  "grid-lines": "frame", // retired → nearest linework
  halftone: "noise-dots", // retired → nearest dotted texture
  // Short-lived batch that was cut after review (all lame in execution).
  "underline-sweep": "edge-rule", // was "like edge rule but worse"
  steps: "corner-bracket", // retired
  ticker: "corner-bracket", // retired
  "dot-field": "corner-bracket", // retired
  "side-bar": "frame", // retired
  notch: "corner-bracket", // retired
  // "accent-rule", "edge-rule", "corner-bracket", "frame", "wave-band" survive.
};

/** Normalize any (possibly legacy) texture id to a current TextureKind. */
export function migrateTextureKind(id: string | undefined | null): TextureKind {
  if (!id) return "corner-glow";
  if (TEXTURES.some((t) => t.id === id)) return id as TextureKind;
  return LEGACY_TEXTURE_MAP[id] ?? "corner-glow";
}

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

// ── Text tier colors ──────────────────────────────────────────────────────────
// The eyebrow / brand name / tagline read as a hierarchy when they aren't all one
// flat color. The name is the hero (base text color); the eyebrow + tagline
// default to MUTED derivations of the base so they sit quieter — deliberately NOT
// the accent color (an accent-tinted texture would wash same-hue text out).
// Shared here so the renderer (canvas.ts) and the panel's swatch preview compute
// the exact same tone from one source.

/** Mute a color toward a soft neutral by `amount` (0 = unchanged, 1 = full grey),
 *  keeping the text's light/dark side so a muted white stays light, muted dark
 *  stays dark — the standard "subordinate text" look. */
export function muteColor(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.min(1, Math.max(0, amount));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const target = lum > 0.5 ? 200 : 90;
  const mix = (c: number) => Math.round(c + (target - c) * a);
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(mix(r))}${to(mix(g))}${to(mix(b))}`;
}

/** How much each tier is muted from the base when set to "auto". */
export const TIER_MUTE = { eyebrow: 0.5, tagline: 0.28 } as const;

/** The auto (derived) color for a tier, given the base text color. */
export function autoTierColor(tier: "eyebrow" | "tagline", base: string): string {
  return muteColor(base, TIER_MUTE[tier]);
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
