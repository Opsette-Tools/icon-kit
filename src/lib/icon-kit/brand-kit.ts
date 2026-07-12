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

/** Which Icon Kit tab a config belongs to. */
export type KitTab = "social" | "favicon";

/**
 * Per-tab design recipes. A blob from "export both" carries BOTH, so pasting it
 * into EITHER tab's Reopen restores that tab losslessly. A single-tab export
 * carries just that tab's recipe.
 *
 * Why this matters (the bug it fixes): the earlier shape had ONE flat `config`,
 * so a combined export could only carry one tab's recipe (whichever was live) —
 * pasting into the other tab silently restored nothing. Keying by tab fixes that.
 */
export type SocialConfigs = Partial<Record<KitTab, SocialConfig>>;

export interface SocialPayload {
  type: "social";
  v: 1;
  source: "opsette";
  data: {
    assets: SocialAsset[];
    /** Per-tab recipes for reopen (new shape). */
    configs?: SocialConfigs;
    /**
     * Legacy single-config field (pre-2026-07-12 blobs). Kept so old exports
     * still reopen: readers fall back to this when `configs[tab]` is absent.
     */
    config?: SocialConfig;
  };
}

/**
 * Build the export blob: rendered images for the board + per-tab recipes for
 * reopen. Pass whichever tab configs you have (one or both).
 */
export function toSocialKitJson(assets: SocialAsset[], configs: SocialConfigs): SocialPayload {
  return {
    type: "social",
    v: 1,
    source: "opsette",
    data: { assets, configs },
  };
}

/**
 * Parse a pasted blob. Strict on the envelope (type/v/source) so a random paste
 * is rejected; never throws. Returns null for anything that isn't a valid
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
  // assets must be an array (may be empty); configs/config are optional.
  if (!Array.isArray(d.assets)) return null;
  if (d.configs !== undefined && (typeof d.configs !== "object" || d.configs === null)) return null;
  if (d.config !== undefined && (typeof d.config !== "object" || d.config === null)) return null;
  return parsed as SocialPayload;
}

/**
 * Resolve the config for a specific tab from a parsed payload, handling both the
 * new per-tab `configs` shape and the legacy flat `config`.
 *
 * Legacy fallback is tab-aware so a legacy favicon blob doesn't get handed to the
 * social tab (and vice-versa): a flat `config` is claimed by a tab only if it
 * "looks like" that tab's state. `looksLike` is supplied by the caller (the panel
 * knows its own signature keys).
 */
export function configForTab(
  payload: SocialPayload,
  tab: KitTab,
  looksLike: (c: SocialConfig) => boolean,
): SocialConfig | null {
  const byTab = payload.data.configs?.[tab];
  if (byTab && typeof byTab === "object") return byTab;
  const legacy = payload.data.config;
  if (legacy && typeof legacy === "object" && looksLike(legacy)) return legacy;
  return null;
}
