// Brand Board export for the Favicon tool.
//
// Brand Board has ONE social slot per tool — a paste REPLACES it wholesale (its
// BoardForm sets `socialAssets: assets`). Icon Kit is favicons/app-icons only
// now (banners moved to Banner Designer), so this emits ONE `type:"social"`
// payload carrying just the favicon set, with the favicon config attached so the
// same blob reopens the design via "Reopen".
//
// The panel persists every change to localStorage, so the embed save-bar can read
// the current favicon state even when it doesn't hold live React state.

import {
  buildFaviconAssets,
  faviconInitial,
  FAVICON_KEY,
  type FaviconState,
} from "../../components/icon-kit/FaviconPanel";
import { toSocialKitJson, type SocialAsset, type SocialConfig, type SocialConfigs } from "./brand-kit";

// Read the favicon tab's persisted state, merged onto its initial so missing/old
// fields are always present. Returns `initial` if nothing's saved yet.
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

export interface CombinedExport {
  json: string;
  assetCount: number;
}

// Build the favicon export blob. `state` is the panel's live in-memory state
// (fresher than localStorage) when available.
export async function buildFaviconExport(state: FaviconState): Promise<CombinedExport> {
  const assets: SocialAsset[] = await buildFaviconAssets(state);

  // Reopen recipe, keyed by tab, so pasting the blob back into Reopen restores
  // the favicon design. (The kit blob shape is shared/frozen with Brand Board.)
  const configs: SocialConfigs = { favicon: state as unknown as SocialConfig };
  const payload = toSocialKitJson(assets, configs);
  return { json: JSON.stringify(payload), assetCount: assets.length };
}
