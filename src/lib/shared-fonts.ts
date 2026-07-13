// AUTO-VENDORED from _shared/fonts/shared-fonts.ts — DO NOT EDIT HERE.
// Edit the master and run `node _shared/fonts/sync.mjs` to re-sync.

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  OPSETTE TOOLS — SHARED FONT LIBRARY  (canonical master)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ONE source of truth for the curated heading + body pairings used by
 *  Palette Studio, Brand Board, and Icon Kit.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  WHY THIS FILE IS DUPLICATED, NOT IMPORTED
 *  ─────────────────────────────────────────────────────────────────────────
 *  Each Opsette tool is its OWN GitHub-Pages repo, deployed independently
 *  (palette-studio / brand-board / icon-kit are separate git remotes with
 *  separate Vite `base` paths). A repo cannot `import` a file that lives in
 *  another repo at build time. So — exactly like `opsette-share`,
 *  `opsette-header`, and `opsette-logo.png` — this library is VENDORED: this
 *  master lives at `_shared/fonts/shared-fonts.ts`, and a byte-identical copy
 *  is placed in each tool at `src/lib/shared-fonts.ts`.
 *
 *  This master is the source of truth. To change the font library:
 *    1. Edit THIS file.
 *    2. Re-copy it into each tool's `src/lib/shared-fonts.ts`
 *       (see `_shared/fonts/sync.mjs` — run `node _shared/fonts/sync.mjs`).
 *  Never hand-edit a vendored copy; it will be overwritten on the next sync.
 *
 *  ─────────────────────────────────────────────────────────────────────────
 *  INTEROP CONTRACT (see docs/BRAND-KIT-INTEROP-CONTRACT.md)
 *  ─────────────────────────────────────────────────────────────────────────
 *  A font reference that crosses a tool boundary (Palette Studio → Brand
 *  Board JSON blob → File Builder) is carried as the pairing `id` from this
 *  library, so all three tools resolve it to the SAME fonts. The frozen v1
 *  palette payload also carries `heading` / `body` / `googleHref` strings
 *  alongside the id for backward compatibility — DO NOT remove those.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Type classifications the library spans. Body must differ from heading. */
export type FontClassification =
  | "geometric-sans"
  | "humanist-sans"
  | "modern-serif"
  | "transitional-serif"
  | "slab-serif"
  | "display"
  | "script";

/** Vibe tags used by the vibe-picker UI and the suggestion algorithm. */
export type VibeTag =
  | "professional"
  | "friendly"
  | "luxury"
  | "minimal"
  | "bold"
  | "technical"
  | "creative"
  | "warm"
  | "editorial"
  | "trustworthy"
  | "startup"
  | "expressive"
  | "premium"
  | "clean"
  | "confident";

/** One font (either the heading or the body slot of a pair). */
export interface FontSpec {
  /** Google Fonts family name, e.g. "Playfair Display". */
  family: string;
  classification: FontClassification;
  /** Weights this pair actually uses/loads for this font, ascending. */
  weights: number[];
  /**
   * The Google Fonts CSS2 URL family param for this font, WITHOUT the leading
   * "family=" — e.g. "Playfair+Display:wght@600;700". Combined across the pair
   * to build one `<link>` href (see `googleHref`).
   */
  googleParam: string;
}

/** A curated heading + body pairing — the atomic unit of the library. */
export interface FontPairing {
  /** Stable slug — the value stored in JSON blobs and used for selection. */
  id: string;
  /** Vibe tags for filtering + the suggestion algorithm's overlap score. */
  vibeTags: VibeTag[];
  heading: FontSpec;
  body: FontSpec;
  /**
   * True when heading + body come from the same designed-together superfamily
   * (e.g. IBM Plex Serif + IBM Plex Sans, DM Serif Display + DM Sans). These
   * get priority ranking in the suggestion algorithm.
   */
  superfamily: boolean;
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  THE LIBRARY — 21 curated pairs spanning the required vibes:
 *    minimal/clean · bold/confident · warm/friendly · luxe/premium ·
 *    editorial/trustworthy · technical/startup · creative/expressive
 *
 *  Every pair obeys the encoded pairing rules:
 *   • body classification ≠ heading classification
 *   • vibe tags overlap or complement between heading and body intent
 *   • never two display, never two scripts, never two serifs w/o weight contrast
 * ─────────────────────────────────────────────────────────────────────────
 */
export const FONT_PAIRINGS: FontPairing[] = [
  // ── MINIMAL / CLEAN ──────────────────────────────────────────────────────
  {
    id: "inter",
    vibeTags: ["minimal", "clean", "professional", "technical"],
    superfamily: true,
    heading: {
      family: "Inter",
      classification: "geometric-sans",
      weights: [700],
      googleParam: "Inter:wght@400;500;700",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500;700",
    },
  },
  {
    id: "space-inter",
    vibeTags: ["minimal", "clean", "technical", "startup"],
    superfamily: false,
    heading: {
      family: "Space Grotesk",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Space+Grotesk:wght@600;700",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },
  {
    id: "manrope-manrope",
    vibeTags: ["minimal", "clean", "professional", "startup"],
    superfamily: true,
    heading: {
      family: "Manrope",
      classification: "geometric-sans",
      weights: [700, 800],
      googleParam: "Manrope:wght@400;500;700;800",
    },
    body: {
      family: "Manrope",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Manrope:wght@400;500;700;800",
    },
  },
  {
    id: "outfit-inter",
    vibeTags: ["minimal", "clean", "startup", "friendly"],
    superfamily: false,
    heading: {
      family: "Outfit",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Outfit:wght@600;700",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },

  // ── BOLD / CONFIDENT ─────────────────────────────────────────────────────
  {
    id: "archivo-inter",
    vibeTags: ["bold", "confident", "professional", "startup"],
    superfamily: false,
    heading: {
      family: "Archivo",
      classification: "geometric-sans",
      weights: [700, 800],
      googleParam: "Archivo:wght@700;800",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },
  {
    id: "anton-roboto",
    vibeTags: ["bold", "confident", "expressive"],
    superfamily: false,
    heading: {
      family: "Anton",
      classification: "display",
      weights: [400],
      googleParam: "Anton",
    },
    body: {
      family: "Roboto",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Roboto:wght@400;500",
    },
  },
  {
    id: "syne-inter",
    vibeTags: ["bold", "creative", "expressive", "confident"],
    superfamily: false,
    heading: {
      family: "Syne",
      classification: "display",
      weights: [700, 800],
      googleParam: "Syne:wght@700;800",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },
  {
    id: "sora-inter",
    vibeTags: ["bold", "technical", "startup", "confident"],
    superfamily: false,
    heading: {
      family: "Sora",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Sora:wght@600;700",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },

  // ── WARM / FRIENDLY ──────────────────────────────────────────────────────
  {
    id: "poppins-inter",
    vibeTags: ["friendly", "warm", "startup", "clean"],
    superfamily: false,
    heading: {
      family: "Poppins",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Poppins:wght@600;700",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },
  {
    id: "quicksand-nunito",
    vibeTags: ["friendly", "warm", "creative"],
    superfamily: false,
    heading: {
      family: "Quicksand",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Quicksand:wght@600;700",
    },
    body: {
      family: "Nunito",
      classification: "humanist-sans",
      weights: [400, 600],
      googleParam: "Nunito:wght@400;600",
    },
  },
  {
    id: "dmsans-dmsans",
    vibeTags: ["friendly", "warm", "clean", "professional"],
    superfamily: true,
    heading: {
      family: "DM Sans",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "DM+Sans:wght@400;500;600;700",
    },
    body: {
      family: "DM Sans",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "DM+Sans:wght@400;500;600;700",
    },
  },
  {
    id: "fraunces-nunito",
    vibeTags: ["warm", "friendly", "creative", "editorial"],
    superfamily: false,
    heading: {
      family: "Fraunces",
      classification: "modern-serif",
      weights: [600, 700],
      googleParam: "Fraunces:opsz,wght@9..144,600;9..144,700",
    },
    body: {
      family: "Nunito Sans",
      classification: "humanist-sans",
      weights: [400, 600],
      googleParam: "Nunito+Sans:wght@400;600",
    },
  },

  // ── LUXE / PREMIUM ───────────────────────────────────────────────────────
  {
    id: "cormorant-lato",
    vibeTags: ["luxury", "premium", "editorial", "trustworthy"],
    superfamily: false,
    heading: {
      family: "Cormorant Garamond",
      classification: "modern-serif",
      weights: [600, 700],
      googleParam: "Cormorant+Garamond:wght@600;700",
    },
    body: {
      family: "Lato",
      classification: "humanist-sans",
      weights: [400, 700],
      googleParam: "Lato:wght@400;700",
    },
  },
  {
    id: "playfair-montserrat",
    vibeTags: ["luxury", "premium", "editorial", "confident"],
    superfamily: false,
    heading: {
      family: "Playfair Display",
      classification: "modern-serif",
      weights: [600, 700],
      googleParam: "Playfair+Display:wght@600;700",
    },
    body: {
      family: "Montserrat",
      classification: "geometric-sans",
      weights: [400, 600],
      googleParam: "Montserrat:wght@400;600",
    },
  },
  {
    id: "playfair-source",
    vibeTags: ["editorial", "trustworthy", "luxury", "premium"],
    superfamily: false,
    heading: {
      family: "Playfair Display",
      classification: "modern-serif",
      weights: [600, 700],
      googleParam: "Playfair+Display:wght@600;700",
    },
    body: {
      family: "Source Sans 3",
      classification: "humanist-sans",
      weights: [400, 600],
      googleParam: "Source+Sans+3:wght@400;600",
    },
  },
  {
    id: "bodoni-lato",
    vibeTags: ["luxury", "premium", "editorial", "expressive"],
    superfamily: false,
    heading: {
      family: "Bodoni Moda",
      classification: "modern-serif",
      weights: [600, 700],
      googleParam: "Bodoni+Moda:wght@600;700",
    },
    body: {
      family: "Lato",
      classification: "humanist-sans",
      weights: [400, 700],
      googleParam: "Lato:wght@400;700",
    },
  },
  {
    id: "marcellus-josefin",
    vibeTags: ["luxury", "premium", "minimal", "creative"],
    superfamily: false,
    heading: {
      family: "Marcellus",
      classification: "transitional-serif",
      weights: [400],
      googleParam: "Marcellus",
    },
    body: {
      family: "Josefin Sans",
      classification: "geometric-sans",
      weights: [400, 500],
      googleParam: "Josefin+Sans:wght@400;500",
    },
  },

  // ── EDITORIAL / TRUSTWORTHY ──────────────────────────────────────────────
  {
    id: "merriweather-lato",
    vibeTags: ["editorial", "trustworthy", "warm", "professional"],
    superfamily: false,
    heading: {
      family: "Merriweather",
      classification: "transitional-serif",
      weights: [700],
      googleParam: "Merriweather:wght@700",
    },
    body: {
      family: "Lato",
      classification: "humanist-sans",
      weights: [400, 700],
      googleParam: "Lato:wght@400;700",
    },
  },
  {
    id: "lora-inter",
    vibeTags: ["editorial", "trustworthy", "warm", "professional"],
    superfamily: false,
    heading: {
      family: "Lora",
      classification: "transitional-serif",
      weights: [600, 700],
      googleParam: "Lora:wght@600;700",
    },
    body: {
      family: "Inter",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Inter:wght@400;500",
    },
  },
  {
    id: "plex-serif-sans",
    vibeTags: ["editorial", "trustworthy", "technical", "professional"],
    superfamily: true,
    heading: {
      family: "IBM Plex Serif",
      classification: "transitional-serif",
      weights: [600, 700],
      googleParam: "IBM+Plex+Serif:wght@600;700",
    },
    body: {
      family: "IBM Plex Sans",
      classification: "humanist-sans",
      weights: [400, 600],
      googleParam: "IBM+Plex+Sans:wght@400;600",
    },
  },
  {
    id: "source-serif-sans",
    vibeTags: ["editorial", "trustworthy", "clean", "professional"],
    superfamily: true,
    heading: {
      family: "Source Serif 4",
      classification: "transitional-serif",
      weights: [600, 700],
      googleParam: "Source+Serif+4:wght@600;700",
    },
    body: {
      family: "Source Sans 3",
      classification: "humanist-sans",
      weights: [400, 600],
      googleParam: "Source+Sans+3:wght@400;600",
    },
  },

  // ── TECHNICAL / STARTUP ──────────────────────────────────────────────────
  {
    id: "spacemono-worksans",
    vibeTags: ["technical", "startup", "creative", "minimal"],
    superfamily: false,
    heading: {
      family: "Space Mono",
      classification: "slab-serif",
      weights: [700],
      googleParam: "Space+Mono:wght@700",
    },
    body: {
      family: "Work Sans",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Work+Sans:wght@400;500",
    },
  },

  // ── CREATIVE / EXPRESSIVE ────────────────────────────────────────────────
  {
    id: "bricolage-worksans",
    vibeTags: ["creative", "expressive", "bold", "startup"],
    superfamily: false,
    heading: {
      family: "Bricolage Grotesque",
      classification: "display",
      weights: [600, 700],
      googleParam: "Bricolage+Grotesque:wght@600;700",
    },
    body: {
      family: "Work Sans",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Work+Sans:wght@400;500",
    },
  },
  {
    id: "archivoblack-archivo",
    vibeTags: ["bold", "confident", "expressive"],
    superfamily: true,
    heading: {
      family: "Archivo Black",
      classification: "display",
      weights: [400],
      googleParam: "Archivo+Black",
    },
    body: {
      family: "Archivo",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Archivo:wght@400;500",
    },
  },

  // ── ADDITIONAL EDITORIAL / LUXE HEADINGS (superset — nothing dropped) ─────
  {
    id: "dmserif-dmsans",
    vibeTags: ["luxury", "premium", "editorial", "confident"],
    superfamily: true,
    heading: {
      family: "DM Serif Display",
      classification: "modern-serif",
      weights: [400],
      googleParam: "DM+Serif+Display",
    },
    body: {
      family: "DM Sans",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "DM+Sans:wght@400;500",
    },
  },
  {
    id: "libre-baskerville-montserrat",
    vibeTags: ["editorial", "trustworthy", "professional", "warm"],
    superfamily: false,
    heading: {
      family: "Libre Baskerville",
      classification: "transitional-serif",
      weights: [700],
      googleParam: "Libre+Baskerville:wght@700",
    },
    body: {
      family: "Montserrat",
      classification: "geometric-sans",
      weights: [400, 600],
      googleParam: "Montserrat:wght@400;600",
    },
  },
  {
    id: "ebgaramond-montserrat",
    vibeTags: ["luxury", "premium", "editorial", "trustworthy"],
    superfamily: false,
    heading: {
      family: "EB Garamond",
      classification: "modern-serif",
      weights: [600, 700],
      googleParam: "EB+Garamond:wght@600;700",
    },
    body: {
      family: "Montserrat",
      classification: "geometric-sans",
      weights: [400, 600],
      googleParam: "Montserrat:wght@400;600",
    },
  },
  {
    id: "spectral-karla",
    vibeTags: ["editorial", "trustworthy", "warm", "creative"],
    superfamily: false,
    heading: {
      family: "Spectral",
      classification: "transitional-serif",
      weights: [600, 700],
      googleParam: "Spectral:wght@600;700",
    },
    body: {
      family: "Karla",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Karla:wght@400;500",
    },
  },
  {
    id: "libre-baskerville-karla",
    vibeTags: ["warm", "friendly", "editorial", "trustworthy"],
    superfamily: false,
    heading: {
      family: "Libre Baskerville",
      classification: "transitional-serif",
      weights: [700],
      googleParam: "Libre+Baskerville:wght@700",
    },
    body: {
      family: "Karla",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Karla:wght@400;500",
    },
  },
  {
    id: "montserrat-opensans",
    vibeTags: ["professional", "clean", "trustworthy", "confident"],
    superfamily: false,
    heading: {
      family: "Montserrat",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Montserrat:wght@600;700",
    },
    body: {
      family: "Open Sans",
      classification: "humanist-sans",
      weights: [400, 600],
      googleParam: "Open+Sans:wght@400;600",
    },
  },
  {
    id: "worksans-worksans",
    vibeTags: ["minimal", "clean", "professional"],
    superfamily: true,
    heading: {
      family: "Work Sans",
      classification: "geometric-sans",
      weights: [600, 700],
      googleParam: "Work+Sans:wght@400;500;600;700",
    },
    body: {
      family: "Work Sans",
      classification: "humanist-sans",
      weights: [400, 500],
      googleParam: "Work+Sans:wght@400;500;600;700",
    },
  },
];

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  DERIVED CONVENIENCE ACCESSORS
 *  Existing tools consumed flatter shapes (headingFamily / bodyFamily /
 *  googleHref / headingWeight / bodyWeight / label). These helpers derive
 *  those from a `FontPairing` so no tool has to duplicate the logic.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Fallback stack appended after a serif family. */
const SERIF_CLASSES: FontClassification[] = [
  "modern-serif",
  "transitional-serif",
  "slab-serif",
];

/** Build a CSS `font-family` stack with a sensible fallback for the class. */
export function cssFamily(spec: FontSpec): string {
  const quoted = `"${spec.family}"`;
  if (SERIF_CLASSES.includes(spec.classification)) return `${quoted}, serif`;
  if (spec.classification === "script") return `${quoted}, cursive`;
  if (spec.classification === "display") return `${quoted}, system-ui, sans-serif`;
  // geometric-sans / humanist-sans
  if (spec.family === "Inter" || spec.family === "Manrope" || spec.family === "Work Sans")
    return `${quoted}, system-ui, sans-serif`;
  return `${quoted}, system-ui, sans-serif`;
}

/** The heaviest weight declared for a font — used when a single weight is drawn. */
export function heaviestWeight(spec: FontSpec): number {
  return spec.weights.length ? Math.max(...spec.weights) : 400;
}

/** The lightest declared weight — used for body copy. */
export function lightestWeight(spec: FontSpec): number {
  return spec.weights.length ? Math.min(...spec.weights) : 400;
}

/** Human label, "Heading / Body" (or just the family when it's a superfamily match). */
export function pairingLabel(p: FontPairing): string {
  if (p.heading.family === p.body.family) return p.heading.family;
  return `${p.heading.family} / ${p.body.family}`;
}

/**
 * The combined Google Fonts CSS2 `<link>` href that loads BOTH fonts of a pair
 * in the weights they use. De-dupes the family param when heading === body.
 */
export function googleHref(p: FontPairing): string {
  const params =
    p.heading.googleParam === p.body.googleParam
      ? [p.heading.googleParam]
      : [p.heading.googleParam, p.body.googleParam];
  return (
    "https://fonts.googleapis.com/css2?" +
    params.map((param) => `family=${param}`).join("&") +
    "&display=swap"
  );
}

/**
 * The combined href for an ARBITRARY set of pairings — used to generate one
 * `<link>` for a whole picker's worth of fonts, or a whole board, instead of
 * hardcoding tags per tool. De-dupes family params across pairs.
 */
export function googleHrefForPairings(pairings: FontPairing[]): string {
  const seen = new Set<string>();
  const params: string[] = [];
  for (const p of pairings) {
    for (const param of [p.heading.googleParam, p.body.googleParam]) {
      if (!seen.has(param)) {
        seen.add(param);
        params.push(param);
      }
    }
  }
  return (
    "https://fonts.googleapis.com/css2?" +
    params.map((param) => `family=${param}`).join("&") +
    "&display=swap"
  );
}

/** Look up a pairing by id; falls back to the first pairing if unknown. */
export function getPairing(id: string): FontPairing {
  return FONT_PAIRINGS.find((p) => p.id === id) ?? FONT_PAIRINGS[0];
}

/** Same as `getPairing` but returns undefined for an unknown id (no fallback). */
export function findPairing(id: string): FontPairing | undefined {
  return FONT_PAIRINGS.find((p) => p.id === id);
}

/**
 * Resolve a pairing from the interop palette blob's `font` object. Prefers the
 * `id` (exact, stored per the interop contract); falls back to matching the
 * `heading`/`body` family strings from older blobs; else the first pairing.
 */
export function resolvePairingFromBlob(font: {
  id?: string;
  heading?: string;
  body?: string;
}): FontPairing {
  if (font.id) {
    const byId = findPairing(font.id);
    if (byId) return byId;
  }
  if (font.heading && font.body) {
    const byFamily = FONT_PAIRINGS.find(
      (p) => p.heading.family === font.heading && p.body.family === font.body,
    );
    if (byFamily) return byFamily;
  }
  return FONT_PAIRINGS[0];
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  HEADING POOL — for the "choose a heading → suggest a body" UX
 *  (the primary interaction model across all three tools).
 *  The distinct heading fonts, first-seen order, each with its home pairing so
 *  a picker can preview/label it and seed a sensible default body.
 * ─────────────────────────────────────────────────────────────────────────
 */
export interface HeadingOption {
  spec: FontSpec;
  /** The pairing this heading was first defined in (for vibe context + default body). */
  homePairing: FontPairing;
}

export const HEADING_FONTS: HeadingOption[] = (() => {
  const seen = new Set<string>();
  const out: HeadingOption[] = [];
  for (const p of FONT_PAIRINGS) {
    if (!seen.has(p.heading.family)) {
      seen.add(p.heading.family);
      out.push({ spec: p.heading, homePairing: p });
    }
  }
  return out;
})();

/**
 * The default body suggestion for a heading — the single best pick, ready to
 * seed a fresh selection when the user first chooses a heading. Returns null
 * only if the heading family is unknown to the library.
 */
export function defaultBodyFor(headingFamily: string): BodySuggestion | null {
  const [top] = suggestBodyFonts(headingFamily, 1);
  return top ?? null;
}

/** Every distinct vibe tag present in the library, in first-seen order. */
export function allVibeTags(): VibeTag[] {
  const seen = new Set<VibeTag>();
  const out: VibeTag[] = [];
  for (const p of FONT_PAIRINGS) {
    for (const t of p.vibeTags) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

/** Pairings that carry a given vibe tag — for the vibe-picker filter. */
export function pairingsByVibe(tag: VibeTag): FontPairing[] {
  return FONT_PAIRINGS.filter((p) => p.vibeTags.includes(tag));
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 *  DYNAMIC FONT LOADING
 *  Inject the Google Fonts <link> for a pairing (or many) at runtime, so no
 *  tool hardcodes <link> tags. Idempotent per href.
 * ─────────────────────────────────────────────────────────────────────────
 */
const loadedHrefs = new Set<string>();

/** Inject one pairing's combined <link> into <head>. Idempotent. Browser-only. */
export function loadPairing(p: FontPairing): void {
  injectHref(googleHref(p));
}

/** Inject a combined <link> for many pairings at once. Idempotent. */
export function loadPairings(pairings: FontPairing[]): void {
  if (!pairings.length) return;
  injectHref(googleHrefForPairings(pairings));
}

function injectHref(href: string): void {
  if (typeof document === "undefined" || loadedHrefs.has(href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  loadedHrefs.add(href);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PAIRING SUGGESTION ALGORITHM
 * ═══════════════════════════════════════════════════════════════════════════
 *  Given a heading font family name, return the top-N suggested BODY fonts
 *  drawn from the library, ranked by:
 *    1. superfamily match first (heading has a known designed-together body),
 *    2. then classification contrast + vibe-overlap score.
 *
 *  Encoded pairing rules (hard constraints — a candidate that violates one is
 *  dropped entirely):
 *    • body classification ≠ heading classification
 *    • never pair two display fonts, two scripts, or two serifs unless there's
 *      strong weight contrast between them.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface BodySuggestion {
  /** The suggested body font. */
  body: FontSpec;
  /** The pairing this body was drawn from (its home pair). */
  pairing: FontPairing;
  /** True if this body is the heading's designed-together superfamily partner. */
  superfamily: boolean;
  /** 0..1 relative score (higher = better fit). */
  score: number;
}

const SERIF_SET = new Set<FontClassification>(SERIF_CLASSES);

function isSerif(c: FontClassification): boolean {
  return SERIF_SET.has(c);
}

/** ≥ 300 units apart is "strong" weight contrast (e.g. 400 body vs 700 head). */
function strongWeightContrast(a: FontSpec, b: FontSpec): boolean {
  return Math.abs(heaviestWeight(a) - lightestWeight(b)) >= 300;
}

/**
 * Hard-constraint check: is `body` a legal partner for `heading`?
 * Mirrors the "never pair two X" rules.
 */
function isLegalPair(heading: FontSpec, body: FontSpec): boolean {
  // Body must be a different classification than heading.
  if (heading.classification === body.classification) return false;
  // Never two display fonts.
  if (heading.classification === "display" && body.classification === "display")
    return false;
  // Never two scripts.
  if (heading.classification === "script" && body.classification === "script")
    return false;
  // Never two serifs without strong weight contrast.
  if (isSerif(heading.classification) && isSerif(body.classification)) {
    return strongWeightContrast(heading, body);
  }
  return true;
}

/** Count shared vibe tags between two pairings (the overlap score input). */
function vibeOverlap(a: VibeTag[], b: VibeTag[]): number {
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

/**
 * Classification-contrast score in [0,1]. Highest when a sans heading meets a
 * serif body (or vice versa) — the classic high-contrast pairing — and lower
 * for same-genre (sans↔sans) contrast.
 */
function contrastScore(heading: FontClassification, body: FontClassification): number {
  const headSerif = isSerif(heading);
  const bodySerif = isSerif(body);
  if (headSerif !== bodySerif) return 1; // serif ↔ sans: strongest contrast
  if (heading === "display" || body === "display") return 0.8; // display anchors well
  return 0.5; // sans ↔ sans (different sub-classes): mild contrast
}

/**
 * Suggest the top `limit` (default 3) body fonts for a given heading family.
 *
 * @param headingFamily  the family name of the chosen heading, e.g. "Sora".
 * @param limit          how many suggestions to return (default 3).
 */
export function suggestBodyFonts(
  headingFamily: string,
  limit = 3,
): BodySuggestion[] {
  // Resolve the heading's FontSpec from any pairing that uses it as a heading.
  const headingPairing = FONT_PAIRINGS.find(
    (p) => p.heading.family === headingFamily,
  );
  if (!headingPairing) return [];
  const heading: FontSpec = headingPairing.heading;

  // Its superfamily partner (if this heading has a designed-together body).
  const superPartnerFamily =
    headingPairing.superfamily && headingPairing.body.family !== headingFamily
      ? headingPairing.body.family
      : headingPairing.superfamily
      ? headingPairing.body.family // same-family superfamily (e.g. Inter/Inter)
      : null;

  // Gather every distinct candidate body font in the library.
  const candidates = new Map<string, { body: FontSpec; pairing: FontPairing }>();
  for (const p of FONT_PAIRINGS) {
    if (!candidates.has(p.body.family)) {
      candidates.set(p.body.family, { body: p.body, pairing: p });
    }
  }

  const scored: BodySuggestion[] = [];
  for (const { body, pairing } of candidates.values()) {
    const isSuper = superPartnerFamily === body.family;

    // Superfamily partners bypass the classification-difference constraint
    // (they were designed to sit together — e.g. Inter heading + Inter body).
    if (!isSuper && !isLegalPair(heading, body)) continue;

    const contrast = contrastScore(heading.classification, body.classification);
    const overlap = vibeOverlap(headingPairing.vibeTags, pairing.vibeTags);
    // Normalize overlap against the heading's own tag count (0..1).
    const overlapNorm = headingPairing.vibeTags.length
      ? overlap / headingPairing.vibeTags.length
      : 0;

    // Weighted blend: contrast is the dominant signal, vibe overlap refines it.
    const base = contrast * 0.65 + overlapNorm * 0.35;
    // Superfamily gets a large priority bump so it always ranks first.
    const score = isSuper ? 1 + base : base;

    scored.push({ body, pairing, superfamily: isSuper, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
