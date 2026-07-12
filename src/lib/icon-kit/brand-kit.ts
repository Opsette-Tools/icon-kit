// Brand Board interop for Icon Kit's Social & Banner builder.
//
// Same "triple duty" pattern as Palette Studio / Signature Studio / QR Creator
// (BRAND-KIT-INTEROP-CONTRACT.md): ONE blob does both jobs.
//   • Brand Board reads `data.assets[]` (the rendered images) to display them.
//   • Reopen reads `data.config` (the full design recipe) to rebuild the session.
//
// The board ignores fields it doesn't know, so adding `config` alongside
// `assets[]` keeps the frozen `type:"social"` shape 100% compatible — the board
// still only needs `assets[]`. Older blobs (exported before `config` existed)
// simply reopen with no config (fromSocialKitJson returns config:null), so the
// paste path degrades gracefully instead of throwing.

/** One rendered image the board displays (the existing, frozen asset shape). */
export interface SocialAsset {
  label: string;
  kind: string;
  image: string; // data URL
  width: number;
  height: number;
}

/**
 * The design recipe — everything needed to rebuild the builder exactly. Kept as
 * an open record so the panel's State can be dropped in whole and merged back
 * onto `initial` without this module needing to know every field (and so adding
 * a field to State never requires editing this file). Transient view-only flags
 * (selection checkboxes, the safe-zone toggle) are fine to carry too — they just
 * restore the last view.
 */
export type SocialConfig = Record<string, unknown>;

export interface SocialPayload {
  type: "social";
  v: 1;
  source: "opsette";
  data: {
    assets: SocialAsset[];
    /** The design recipe for reopen. Optional so old blobs still validate. */
    config?: SocialConfig;
  };
}

/** Build the export blob: rendered images for the board + config for reopen. */
export function toSocialKitJson(assets: SocialAsset[], config: SocialConfig): SocialPayload {
  return {
    type: "social",
    v: 1,
    source: "opsette",
    data: { assets, config },
  };
}

/**
 * Parse a pasted blob. Strict on the envelope (type/v/source) so a random paste
 * is rejected; never throws. Returns the parsed payload (whose `data.config` may
 * be undefined for pre-config blobs) or null for anything that isn't a valid
 * Opsette social blob.
 */
export function fromSocialKitJson(raw: string): SocialPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p.type !== "social" || p.v !== 1 || p.source !== "opsette") return null;
  const data = p.data;
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  // assets must be an array (may be empty); config is optional.
  if (!Array.isArray(d.assets)) return null;
  if (d.config !== undefined && (typeof d.config !== "object" || d.config === null)) return null;
  return parsed as SocialPayload;
}
