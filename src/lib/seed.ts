// Icon Kit's adapter for the shared brand-core seed (Mechanism 1 of
// docs/KIT-SUITE-CONNECT-PLAN.md). Maps a generic BrandCore — the four facts
// that ride in a ?seed= URL — onto BOTH the Social and Favicon panels, so both
// open pre-filled with the client's name, logo, and brand color.
//
// Icon Kit's two panels each own a `usePersistentReducer` that hydrates from
// localStorage and re-mounts on every tab switch. So rather than thread a seed
// through props (which would re-fire on each tab switch), we apply the seed
// ONCE at App mount by merging it into each panel's localStorage key BEFORE the
// panels mount. They then hydrate from it naturally, and it persists correctly.
// The URL param is cleared right after, so it applies exactly once.
import type { BrandCore } from "./opsette-kit-link";
import { SOCIAL_KEY, socialInitial, looksLikeSocial } from "@/components/icon-kit/SocialPanel";
import { FAVICON_KEY, faviconInitial, looksLikeFavicon } from "@/components/icon-kit/FaviconPanel";
import { fromSocialKitJson, configForTab } from "./icon-kit/brand-kit";

function normalizeHex(hex: string): string | null {
  let h = hex.trim();
  if (!h) return null;
  if (!h.startsWith("#")) h = `#${h}`;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h.toLowerCase() : null;
}

function pickPrimary(core: BrandCore): string | null {
  const colors = core.colors ?? [];
  const primary =
    colors.find((c) => c.role === "primary" || c.role === "base") ?? colors[0];
  return primary ? normalizeHex(primary.hex) : null;
}

// First letters of the first two words, uppercased — a sensible favicon fallback
// when the seed carries a name but no logo ("Marigold Coffee" → "MC").
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const letters = words.slice(0, 2).map((w) => w[0]);
  return letters.join("").toUpperCase();
}

// Merge a seed onto whatever is already saved under `key` and write it back.
// Reading the existing value first means a seed only overrides the fields it
// carries; a client's other in-progress choices survive.
function mergeIntoStorage(key: string, base: object, patch: object): void {
  if (typeof window === "undefined" || Object.keys(patch).length === 0) return;
  let saved: object = {};
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) saved = JSON.parse(raw) as object;
  } catch {
    saved = {};
  }
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...base, ...saved, ...patch }));
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/**
 * Apply a decoded brand core to Icon Kit's two panels (via localStorage). Safe
 * to call once at App mount; a no-op when the core carries nothing usable.
 */
export function applyIconKitSeed(core: BrandCore): void {
  const primary = pickPrimary(core);
  const logo = core.logo && core.logo.startsWith("data:") ? core.logo : null;

  // ── Social & Banners ──────────────────────────────────────────────────────
  const social: Record<string, unknown> = {};
  if (core.name) social.headline = core.name;
  if (core.tagline) social.subhead = core.tagline;
  if (logo) {
    social.logoDataUrl = logo;
    social.watermark = true; // a supplied logo is worth showing as the watermark
  }
  if (primary) {
    social.solidColor = primary;
    social.gradFrom = primary;
    social.accentColor = primary;
  }
  mergeIntoStorage(SOCIAL_KEY, socialInitial, social);

  // ── Favicon ───────────────────────────────────────────────────────────────
  const favicon: Record<string, unknown> = {};
  if (core.name) favicon.appName = core.name;
  if (primary) favicon.bgColor = primary;
  if (logo) {
    favicon.tab = "image";
    favicon.imageDataUrl = logo;
  } else if (core.name) {
    const initials = initialsOf(core.name);
    if (initials) {
      favicon.tab = "initials";
      favicon.initialsText = initials;
    }
  }
  mergeIntoStorage(FAVICON_KEY, faviconInitial, favicon);
}

/**
 * Apply a FULL Icon Kit "social" blob (Mechanism 3 embed load) to both panels via
 * localStorage, using the same reopen recipe the panels' own paste modal uses
 * (`fromSocialKitJson` → `configForTab`). Unlike the seed (a slim BrandCore), this
 * is a real exported blob carrying each tab's saved config. We merge whichever
 * tab configs the blob carries into their storage keys, so a subsequent panel
 * (re)mount hydrates branded — no props, no tab-switch re-fire.
 *
 * Returns which tab to show: "social" if the blob carried a social config (the
 * banner is what you'd revise first), else "favicon" if only that was present,
 * else null (nothing usable — leave the tab as-is).
 */
export function applyEmbedBlob(raw: string): "social" | "favicon" | null {
  const parsed = fromSocialKitJson(raw);
  if (!parsed) return null;
  const social = configForTab(parsed, "social", looksLikeSocial);
  const favicon = configForTab(parsed, "favicon", looksLikeFavicon);
  if (social) mergeIntoStorage(SOCIAL_KEY, socialInitial, social);
  if (favicon) mergeIntoStorage(FAVICON_KEY, faviconInitial, favicon);
  if (social) return "social";
  if (favicon) return "favicon";
  return null;
}
