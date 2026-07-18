// Crop an uploaded image down to a chosen square region, entirely client-side.
//
// The crispness rule: we crop from the image's NATIVE resolution, never from a
// shrunk on-screen preview. The cropper UI hands us a rectangle in FRACTIONAL
// coordinates (0..1 of the source's own width/height), so this bake reads the
// exact source pixels for that region into a fresh square canvas. A 32px favicon
// then downsamples from the sharpest possible source (renderIcon supersamples on
// top of that), instead of from an already-degraded copy.

import { loadImage } from "./canvas";

/** A square (or free) crop region expressed as fractions of the source image. */
export interface CropRect {
  /** Left edge, 0..1 of source width. */
  x: number;
  /** Top edge, 0..1 of source height. */
  y: number;
  /** Width, 0..1 of source width. */
  w: number;
  /** Height, 0..1 of source height. */
  h: number;
}

/** The full-image crop (no cropping) — handy as an initial/reset value. */
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Produce a new PNG data URL containing only the cropped region, at native
 * source resolution. The output is exactly the pixels inside `rect` — no resize,
 * no padding — so the downstream icon pipeline receives the crispest source and
 * decides its own target sizes. PNG (not JPEG) to preserve transparency, which a
 * logo badge on a transparent background needs.
 */
export async function bakeCrop(sourceDataUrl: string, rect: CropRect): Promise<string> {
  const img = await loadImage(sourceDataUrl);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) return sourceDataUrl;

  // Convert fractional rect → source pixels, clamped inside the image bounds.
  const cx = Math.max(0, Math.round(rect.x * sw));
  const cy = Math.max(0, Math.round(rect.y * sh));
  const cw = Math.max(1, Math.min(sw - cx, Math.round(rect.w * sw)));
  const ch = Math.max(1, Math.min(sh - cy, Math.round(rect.h * sh)));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceDataUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Copy exactly the source region 1:1 (no scaling here — full native pixels).
  ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  return canvas.toDataURL("image/png");
}

/**
 * Suggest a crop rectangle that trims away uniform, low-alpha or near-white/
 * near-black borders around the real content — the "auto-trim whitespace"
 * convenience. It only removes surrounding margin; it never tries to guess WHICH
 * content to keep (that's the user's job with the manual box). Returns FULL_CROP
 * if it can't find a confident bounding box.
 *
 * Detection: scan a downscaled copy, treat a pixel as "background" if it's
 * transparent OR very close to the image's dominant corner color, then find the
 * tight bounding box of everything that ISN'T background.
 */
export async function autoTrimRect(sourceDataUrl: string): Promise<CropRect> {
  const img = await loadImage(sourceDataUrl);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) return FULL_CROP;

  // Downscale for a fast scan; the box maps back via fractions so precision at
  // full res is fine.
  const SCAN_MAX = 320;
  const scale = Math.min(1, SCAN_MAX / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return FULL_CROP;
  ctx.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return FULL_CROP;
  }

  // Sample the four corners to learn the background color; use the average.
  const corners = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  let br = 0, bg = 0, bb = 0, ba = 0;
  for (const c of corners) {
    br += data[c]; bg += data[c + 1]; bb += data[c + 2]; ba += data[c + 3];
  }
  br /= 4; bg /= 4; bb /= 4; ba /= 4;

  const bgIsTransparent = ba < 24;
  const TOL = 42; // color distance below which a pixel counts as background

  const isBackground = (i: number): boolean => {
    const a = data[i + 3];
    if (bgIsTransparent) return a < 24;
    if (a < 24) return true; // transparent pixels are always background
    const dr = data[i] - br, dg = data[i + 1] - bg, db = data[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db) < TOL;
  };

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!isBackground(i)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return FULL_CROP; // all background — bail

  // A hair of breathing room so we don't shave the edge of the mark.
  const padX = Math.round((maxX - minX) * 0.02);
  const padY = Math.round((maxY - minY) * 0.02);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(w - 1, maxX + padX);
  maxY = Math.min(h - 1, maxY + padY);

  return {
    x: minX / w,
    y: minY / h,
    w: (maxX - minX + 1) / w,
    h: (maxY - minY + 1) / h,
  };
}
