// Combined Brand Board export across BOTH Icon Kit tabs.
//
// The problem this solves: Brand Board has ONE social slot — a second paste
// REPLACES the first, it doesn't append (brand-board BoardForm sets
// `socialAssets: assets` wholesale). So to get banners AND favicons onto the
// board, Icon Kit must emit ONE blob carrying both sets. This module gathers
// assets from either or both tabs into a single `type:"social"` payload.
//
// Placeholder guard (Ruthnie's requirement): the Favicon tab is never empty — it
// defaults to "OP" on a green tile. A combined export must NOT ship that stock
// mark into a client's kit just because the tab exists. So "both" only ever
// includes a tab the user actually TOUCHED (see `*IsDirty`); an untouched tab is
// offered neither as a choice nor silently bundled.
//
// The inactive tab is unmounted, so its live React state isn't reachable — but
// both panels persist every change to localStorage, so we read the inactive tab's
// state from there. The active tab passes its live state straight in.

import {
  buildFaviconAssets,
  faviconIsDirty,
  faviconInitial,
  FAVICON_KEY,
  type FaviconState,
} from "../../components/icon-kit/FaviconPanel";
import {
  buildSocialAssets,
  socialIsDirty,
  socialInitial,
  SOCIAL_KEY,
  type SocialState,
} from "../../components/icon-kit/SocialPanel";
import { toSocialKitJson, type SocialAsset, type SocialConfig } from "./brand-kit";

// Read a tab's persisted state, merged onto its initial so missing/old fields are
// always present. Returns `initial` if nothing's saved yet.
function readPersisted<S extends object>(key: string, initial: S): S {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return initial;
    return { ...initial, ...(JSON.parse(raw) as Partial<S>) };
  } catch {
    return initial;
  }
}

export function readFaviconState(): FaviconState {
  return readPersisted(FAVICON_KEY, faviconInitial);
}
export function readSocialState(): SocialState {
  return readPersisted(SOCIAL_KEY, socialInitial);
}

/** Which tab a "this tab" export is for. */
export type ExportScope = "social" | "favicon" | "both";

/** Whether the OTHER tab has real work, so "Both" should be offered/enabled. */
export function otherTabIsDirty(current: "social" | "favicon"): boolean {
  return current === "social"
    ? faviconIsDirty(readFaviconState())
    : socialIsDirty(readSocialState());
}

export interface CombinedExport {
  json: string;
  assetCount: number;
}

// Build the blob for the chosen scope. For "both" we only fold in a tab that's
// actually dirty (placeholder guard), and we attach the CURRENT tab's config so
// the same blob still reopens the design the user is looking at. `liveScope` /
// `liveState` are the mounted tab's in-memory state (fresher than localStorage).
export async function buildCombinedExport(
  scope: ExportScope,
  liveScope: "social" | "favicon",
  liveState: SocialState | FaviconState,
): Promise<CombinedExport> {
  const social = liveScope === "social" ? (liveState as SocialState) : readSocialState();
  const favicon = liveScope === "favicon" ? (liveState as FaviconState) : readFaviconState();

  const assets: SocialAsset[] = [];
  const wantSocial = scope === "social" || (scope === "both" && socialIsDirty(social));
  const wantFavicon = scope === "favicon" || (scope === "both" && faviconIsDirty(favicon));

  // Banners first (wide, lead the board), then the favicon square set.
  if (wantSocial) assets.push(...(await buildSocialAssets(social)));
  if (wantFavicon) assets.push(...(await buildFaviconAssets(favicon)));

  // Config for reopen = the tab the user is on, so pasting the blob back into that
  // tab's Reopen rebuilds what they were editing. (The other tab's design still
  // travels as rendered assets; only one tab's editable recipe fits one blob.)
  const config = liveState as unknown as SocialConfig;
  const payload = toSocialKitJson(assets, config);
  return { json: JSON.stringify(payload), assetCount: assets.length };
}
