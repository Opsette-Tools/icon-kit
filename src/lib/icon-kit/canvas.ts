// Canvas rendering helpers for Icon Kit. All client-side.

import {
  getFontPair,
  ensureFontLoaded,
  type FontPair,
  type TextureKind,
  type WatermarkEdge,
  type HighlightStyle,
  hexToRgb,
  AVATAR_SAFE,
} from "./social-design";

export type SourceSpec =
  | { type: "image"; dataUrl: string }
  | { type: "initials"; text: string; color: string }
  | { type: "emoji"; char: string };

export type BgMode = "transparent" | "solid" | "tile";

export interface IconOpts {
  source: SourceSpec;
  bgMode: BgMode;
  bgColor: string;
  paddingPct: number; // 0-30 (% of size, per side)
  radiusPct: number; // 0-50 (% of size; 50 = circle)
  forceOpaque?: boolean; // apple-touch-icon must be opaque
  extraPaddingPct?: number; // for maskable
}

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export async function ensureInter(): Promise<void> {
  if (typeof document === "undefined" || !(document as any).fonts) return;
  try {
    await Promise.all([
      (document as any).fonts.load('700 64px "Inter"'),
      (document as any).fonts.load('800 64px "Inter"'),
    ]);
  } catch {
    /* noop */
  }
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

// Render the icon at `size`, but draw on a supersampled canvas first and
// downscale once with high-quality smoothing. Drawing tiny marks (16/32px)
// directly produces mushy, low-contrast favicons — the classic "ink ran out"
// look. Rendering at >=128px and downsampling keeps edges crisp.
export async function renderIcon(size: number, opts: IconOpts): Promise<HTMLCanvasElement> {
  if (size >= 96) return renderIconAt(size, opts);

  const SUPER = Math.max(128, size * 4);
  const big = await renderIconAt(SUPER, opts);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.clearRect(0, 0, size, size);
  octx.drawImage(big, 0, 0, size, size);
  return out;
}

async function renderIconAt(size: number, opts: IconOpts): Promise<HTMLCanvasElement> {
  await ensureInter();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, size, size);

  const radius = (opts.radiusPct / 100) * size;
  const mustFill = opts.forceOpaque || opts.bgMode === "solid" || opts.bgMode === "tile";

  if (mustFill) {
    ctx.fillStyle = opts.bgColor;
    if (opts.bgMode === "tile" || (opts.forceOpaque && opts.bgMode === "transparent")) {
      // Tile: rounded rect. For force-opaque transparent fallback, fill flat.
      if (opts.bgMode === "tile") {
        roundedRectPath(ctx, 0, 0, size, size, radius);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, size, size);
      }
    } else {
      ctx.fillRect(0, 0, size, size);
    }
  }

  // Clip to rounded tile so content stays inside if tile mode
  if (opts.bgMode === "tile") {
    roundedRectPath(ctx, 0, 0, size, size, radius);
    ctx.clip();
  }

  const pad = ((opts.paddingPct + (opts.extraPaddingPct ?? 0)) / 100) * size;
  const safe = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;

  if (opts.source.type === "image") {
    try {
      const img = await loadImage(opts.source.dataUrl);
      const ratio = Math.min(safe / img.width, safe / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    } catch {
      /* noop */
    }
  } else if (opts.source.type === "initials" || opts.source.type === "emoji") {
    const text = opts.source.type === "initials" ? opts.source.text : opts.source.char;
    const color = opts.source.type === "initials" ? opts.source.color : "#000";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Binary search font size to fit width and ~0.85 height
    let lo = 4;
    let hi = safe * 1.2;
    const family =
      opts.source.type === "emoji"
        ? '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
        : '"Inter", system-ui, sans-serif';
    const weight = opts.source.type === "initials" ? "800" : "400";
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      ctx.font = `${weight} ${mid}px ${family}`;
      const m = ctx.measureText(text);
      const w = m.width;
      const h = mid * 0.95;
      if (w > safe || h > safe * 0.9) hi = mid;
      else lo = mid;
    }
    ctx.font = `${weight} ${lo}px ${family}`;
    // Slight optical adjust for emoji baselines
    const baselineAdjust = opts.source.type === "emoji" ? lo * 0.04 : 0;
    ctx.fillText(text, cx, cy + baselineAdjust);
  }

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type),
  );
}

// ===== SVG favicon =====
// A scalable favicon.svg is the modern best practice — browsers prefer it and
// it stays crisp at any size. We mirror the canvas geometry (bg, radius,
// padding) so the SVG matches the generated PNGs. Uploaded raster images are
// embedded as a data-URI inside a scalable SVG container.

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c] as string),
  );

export function buildSvg(opts: IconOpts): string {
  const S = 512;
  const radius = (opts.radiusPct / 100) * S;
  const mustFill = opts.bgMode === "solid" || opts.bgMode === "tile";
  const pad = ((opts.paddingPct + (opts.extraPaddingPct ?? 0)) / 100) * S;
  const safe = S - pad * 2;
  const cx = S / 2;

  let bg = "";
  if (mustFill) {
    const r = opts.bgMode === "tile" ? radius : 0;
    bg = `<rect width="${S}" height="${S}" rx="${r}" ry="${r}" fill="${escapeXml(opts.bgColor)}"/>`;
  }

  let clip = "";
  let clipAttr = "";
  if (opts.bgMode === "tile") {
    clip = `<clipPath id="tile"><rect width="${S}" height="${S}" rx="${radius}" ry="${radius}"/></clipPath>`;
    clipAttr = ` clip-path="url(#tile)"`;
  }

  let content = "";
  if (opts.source.type === "image") {
    // Embed the raster centered & contained in the safe area.
    content = `<image href="${escapeXml(opts.source.dataUrl)}" x="${pad}" y="${pad}" width="${safe}" height="${safe}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    const text = opts.source.type === "initials" ? opts.source.text : opts.source.char;
    const color = opts.source.type === "initials" ? opts.source.color : "#000000";
    // Size text to roughly fill the safe area's height; SVG handles the scaling.
    const fontSize = safe * 0.72;
    const family =
      opts.source.type === "emoji"
        ? "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"
        : "'Inter',system-ui,sans-serif";
    const weight = opts.source.type === "initials" ? "800" : "400";
    content = `<text x="${cx}" y="${S / 2}" font-family="${family}" font-size="${fontSize}" font-weight="${weight}" fill="${escapeXml(color)}" text-anchor="middle" dominant-baseline="central">${escapeXml(text)}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${clip}${bg}<g${clipAttr}>${content}</g></svg>`;
}

// ===== Social image =====

export type SocialLayout = "centered" | "logo-tl" | "split";

export type SocialBg =
  | { type: "solid"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "image"; dataUrl: string; overlay: number; duotone?: DuotoneSpec };

/** Map a photo into two brand colors so it stops fighting the palette. */
export interface DuotoneSpec {
  shadow: string; // color for the dark end
  highlight: string; // color for the light end
}

/** Optional design layers shared by the OG card and every banner. */
export interface DesignLayers {
  fontId: string;
  eyebrow?: string; // small ALL-CAPS line above the name
  accentColor: string; // drives texture + watermark tint fallback
  texture: TextureKind;
  watermark?: {
    dataUrl: string;
    edge: WatermarkEdge;
    opacity: number; // 0..1
    scale: number; // multiple of the canvas short side (e.g. 1.4)
  };
}

export interface SocialOpts {
  headline: string;
  subhead: string;
  logoDataUrl?: string;
  background: SocialBg;
  layout: SocialLayout;
  textColor: string;
  design: DesignLayers;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

// Font-aware headline fit. `font` is the full CSS family stack; `weight` the
// weight to draw. Falls back to Inter/800 so callers that don't care still work.
function fitHeadline(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  max: number,
  min: number,
  font = '"Inter", system-ui, sans-serif',
  weight = 800,
) {
  let lo = min;
  let hi = max;
  let best = min;
  let bestLines: string[] = [text];
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    ctx.font = `${weight} ${mid}px ${font}`;
    const lines = wrapLines(ctx, text, maxWidth, maxLines);
    const joined = lines.join(" ");
    const fits = joined.replace(/\s+/g, " ") === text.replace(/\s+/g, " ") && lines.length <= maxLines;
    if (fits) {
      best = mid;
      bestLines = lines;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  ctx.font = `${weight} ${best}px ${font}`;
  return { size: best, lines: bestLines };
}

// ── Shared design layers ─────────────────────────────────────────────────────
// Painted in z-order: background → watermark → texture → content. Both the OG
// card and every banner run these, so a design reads as one system across sizes.

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Recolor a photo into two brand colors (duotone). We map luminance → a ramp
// between `shadow` and `highlight`, so the photo adopts the palette instead of
// clashing with it. Done on an offscreen canvas then drawn as the background.
function applyDuotone(img: HTMLImageElement, W: number, H: number, spec: DuotoneSpec): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = W;
  off.height = H;
  const octx = off.getContext("2d")!;
  const ratio = Math.max(W / img.width, H / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  octx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const data = octx.getImageData(0, 0, W, H);
  const px = data.data;
  const lo = hexToRgb(spec.shadow);
  const hi = hexToRgb(spec.highlight);
  for (let i = 0; i < px.length; i += 4) {
    // perceived luminance of the source pixel
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    px[i] = lo.r + (hi.r - lo.r) * l;
    px[i + 1] = lo.g + (hi.g - lo.g) * l;
    px[i + 2] = lo.b + (hi.b - lo.b) * l;
  }
  octx.putImageData(data, 0, 0);
  return off;
}

// Big, low-opacity logo bleeding off an edge as a background texture. The single
// biggest "designed vs. template" lift. Clipped to the canvas, so the overflow
// just bleeds. Drawn AFTER the background, BEFORE content, so text stays on top.
function paintWatermark(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  W: number,
  H: number,
  wm: NonNullable<DesignLayers["watermark"]>,
) {
  const short = Math.min(W, H);
  const target = short * wm.scale;
  const ratio = target / Math.max(logo.width, logo.height);
  const lw = logo.width * ratio;
  const lh = logo.height * ratio;

  let x = 0;
  let y = 0;
  switch (wm.edge) {
    case "right":
      x = W - lw * 0.72; // ~28% stays on-canvas, rest bleeds right
      y = (H - lh) / 2;
      break;
    case "left":
      x = -lw * 0.28;
      y = (H - lh) / 2;
      break;
    case "bottom-right":
      x = W - lw * 0.62;
      y = H - lh * 0.62;
      break;
    case "bottom-left":
      x = -lw * 0.38;
      y = H - lh * 0.62;
      break;
  }
  ctx.save();
  ctx.globalAlpha = wm.opacity;
  ctx.drawImage(logo, x, y, lw, lh);
  ctx.restore();
}

// One tasteful geometric element, tinted from the accent color, low alpha.
function paintTexture(
  ctx: CanvasRenderingContext2D,
  kind: TextureKind,
  accent: string,
  W: number,
  H: number,
) {
  if (kind === "none") return;
  ctx.save();
  const short = Math.min(W, H);
  switch (kind) {
    case "corner-blob": {
      // A soft radial glow anchored top-right — reads as depth, not a shape.
      const r = short * 1.1;
      const grad = ctx.createRadialGradient(W, 0, 0, W, 0, r);
      grad.addColorStop(0, withAlpha(accent, 0.28));
      grad.addColorStop(1, withAlpha(accent, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      break;
    }
    case "diagonal": {
      // A single angled color block sweeping off the right side.
      ctx.fillStyle = withAlpha(accent, 0.16);
      ctx.beginPath();
      ctx.moveTo(W * 0.62, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(W * 0.82, H);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "accent-rule": {
      // A short bright rule in the TOP-left — an editorial kicker that sits
      // above the content block, so it never collides with centered text lower
      // down (which the old bottom rule did).
      const t = Math.max(3, Math.round(short * 0.014));
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.95;
      const inset = Math.round(W * 0.055);
      const topY = Math.round(H * 0.12);
      ctx.fillRect(inset, topY, Math.min(W * 0.14, short * 0.8), t);
      break;
    }
    case "dot-grid": {
      // A restrained field of dots in the top-right region.
      const gap = Math.max(18, Math.round(short * 0.06));
      const dot = Math.max(2, Math.round(short * 0.008));
      ctx.fillStyle = withAlpha(accent, 0.5);
      const cols = 6;
      const rows = 4;
      const ox = W - gap * (cols + 0.5);
      const oy = gap * 0.8;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(ox + c * gap, oy + r * gap, dot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "arc-lines": {
      // Concentric thin arcs radiating from the bottom-right — subtle motion.
      ctx.strokeStyle = withAlpha(accent, 0.35);
      ctx.lineWidth = Math.max(2, Math.round(short * 0.006));
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(W, H, short * (0.3 + i * 0.22), Math.PI, Math.PI * 1.5);
        ctx.stroke();
      }
      break;
    }
    case "stripes": {
      // Thin vertical bars fading in from the right edge — structured/editorial.
      const barW = Math.max(3, Math.round(short * 0.02));
      const gap = barW * 2.6;
      const startX = W * 0.55;
      for (let x = startX; x < W; x += gap) {
        // Fade the bars in toward the right so they read as texture, not a fence.
        const t = (x - startX) / (W - startX); // 0..1
        ctx.fillStyle = withAlpha(accent, 0.06 + t * 0.22);
        ctx.fillRect(x, 0, barW, H);
      }
      break;
    }
    case "confetti": {
      // Irregular scattered dots + tiny bars — playful, not a rigid grid.
      // Deterministic pseudo-random (seeded) so preview and export match and we
      // never touch Math.random (family rule).
      const rand = mulberry32(0x5eed ^ Math.round(W) ^ (Math.round(H) << 8));
      const count = 26;
      for (let i = 0; i < count; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const sz = short * (0.008 + rand() * 0.02);
        ctx.fillStyle = withAlpha(accent, 0.28 + rand() * 0.3);
        if (rand() > 0.6) {
          // small rotated bar
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((rand() - 0.5) * Math.PI);
          ctx.fillRect(-sz, -sz * 0.28, sz * 2, sz * 0.56);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, sz, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "wave-band": {
      // A soft organic curved band across the bottom — modern SaaS feel.
      const baseY = H * 0.7;
      const amp = H * 0.12;
      ctx.beginPath();
      ctx.moveTo(0, baseY);
      ctx.bezierCurveTo(W * 0.3, baseY - amp, W * 0.6, baseY + amp, W, baseY - amp * 0.4);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = withAlpha(accent, 0.16);
      ctx.fill();
      // A second, tighter band for depth.
      ctx.beginPath();
      ctx.moveTo(0, baseY + amp * 0.6);
      ctx.bezierCurveTo(W * 0.35, baseY - amp * 0.2, W * 0.65, baseY + amp * 1.2, W, baseY + amp * 0.3);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = withAlpha(accent, 0.12);
      ctx.fill();
      break;
    }
    case "grid-lines": {
      // Faint blueprint-style crosshatch — technical / architectural.
      ctx.strokeStyle = withAlpha(accent, 0.14);
      ctx.lineWidth = Math.max(1, Math.round(short * 0.003));
      const step = Math.max(28, Math.round(short * 0.11));
      for (let x = step; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = step; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      break;
    }
    case "halftone": {
      // Dots that grow in size across the canvas — a real print-design tell.
      // Anchored bottom-right; dots shrink toward the top-left so text stays clean.
      const step = Math.max(16, Math.round(short * 0.055));
      const maxR = step * 0.44;
      for (let y = 0; y < H + step; y += step) {
        for (let x = 0; x < W + step; x += step) {
          // distance from bottom-right corner, normalized
          const dx = (W - x) / W;
          const dy = (H - y) / H;
          const d = Math.min(1, Math.hypot(dx, dy));
          const r = maxR * (1 - d); // biggest at bottom-right
          if (r < 0.5) continue;
          ctx.fillStyle = withAlpha(accent, 0.4);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
  ctx.restore();
}

// Tiny deterministic PRNG (mulberry32) — seeded, so confetti placement is stable
// across renders and identical between the on-screen preview and the export.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Paint background + watermark + texture in order. Returns the resolved logo
// image (loaded once, reused for the content block) to avoid a double load.
async function paintCanvasLayers(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bg: SocialBg,
  design: DesignLayers,
  logoDataUrl: string | undefined,
  allowPhoto: boolean,
): Promise<HTMLImageElement | null> {
  // Background
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === "gradient") {
    paintGradient(ctx, bg, W, H);
  } else if (bg.type === "image" && allowPhoto) {
    try {
      const img = await loadImage(bg.dataUrl);
      if (bg.duotone) {
        const duo = applyDuotone(img, W, H, bg.duotone);
        ctx.drawImage(duo, 0, 0, W, H);
      } else {
        const ratio = Math.max(W / img.width, H / img.height);
        const dw = img.width * ratio;
        const dh = img.height * ratio;
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      ctx.fillStyle = `rgba(0,0,0,${bg.overlay})`;
      ctx.fillRect(0, 0, W, H);
    } catch {
      ctx.fillStyle = design.accentColor || "#111";
      ctx.fillRect(0, 0, W, H);
    }
  } else {
    // Photo not allowed on this surface (banners) — fall back to accent solid.
    ctx.fillStyle = design.accentColor || "#111";
    ctx.fillRect(0, 0, W, H);
  }

  // Load the logo once (used for both watermark + content).
  let logoImg: HTMLImageElement | null = null;
  if (logoDataUrl) {
    try {
      logoImg = await loadImage(logoDataUrl);
    } catch {
      logoImg = null;
    }
  }

  // Watermark (uses the logo)
  if (design.watermark && logoImg) {
    paintWatermark(ctx, logoImg, W, H, design.watermark);
  }

  // Texture layer
  paintTexture(ctx, design.texture, design.accentColor, W, H);

  return logoImg;
}

function paintGradient(
  ctx: CanvasRenderingContext2D,
  bg: { from: string; to: string; angle: number },
  W: number,
  H: number,
) {
  const a = (bg.angle * Math.PI) / 180;
  const x = Math.cos(a);
  const y = Math.sin(a);
  const cx = W / 2;
  const cy = H / 2;
  const half = Math.abs(x) * (W / 2) + Math.abs(y) * (H / 2);
  const grad = ctx.createLinearGradient(cx - x * half, cy - y * half, cx + x * half, cy + y * half);
  grad.addColorStop(0, bg.from);
  grad.addColorStop(1, bg.to);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// Draw the eyebrow line (small, ALL-CAPS, letter-spaced) at (x, y) in the given
// alignment. Returns the height consumed so callers can advance the cursor.
function drawEyebrow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  bodyFamily: string,
  align: CanvasTextAlign,
) {
  const letters = text.toUpperCase();
  ctx.font = `600 ${size}px ${bodyFamily}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.82;
  // Manual letter-spacing for cross-browser consistency (canvas letterSpacing
  // is unevenly supported). Space chars are tracked too.
  const track = size * 0.16;
  const widths = [...letters].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((s, w) => s + w, 0) + track * Math.max(0, letters.length - 1);
  let startX = x;
  if (align === "center") startX = x - total / 2;
  else if (align === "right") startX = x - total;
  ctx.textAlign = "left";
  let cx = startX;
  for (let i = 0; i < letters.length; i++) {
    ctx.fillText(letters[i], cx, y);
    cx += widths[i] + track;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = align;
}

// Draw a single line of text left-aligned at (x, y), emphasizing the selected
// words in the chosen style. `phrase` is a "|"-joined list of the exact words to
// spotlight (order-independent); they may be adjacent OR scattered. `bold`
// recolors + bolds each word inline (no block, no collision — the elegant
// default); marker draws a filled block per contiguous run; underline/glow apply
// per word. `size`/`weight`/`font` describe the base text.
function drawHighlightedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  phrase: string,
  x: number,
  y: number,
  size: number,
  font: string,
  weight: number,
  textColor: string,
  accentColor: string,
  markerTextColor: string,
  style: HighlightStyle,
) {
  const baseFont = `${weight} ${size}px ${font}`;
  const boldWeight = Math.min(900, weight + 200);
  const boldFont = `${boldWeight} ${size}px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const targets = new Set(
    phrase
      .split("|")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean),
  );

  // Split into tokens preserving spaces, and flag which are matched words.
  const tokens = text.split(/(\s+)/); // keeps the whitespace tokens
  const isMatch = (tok: string) => tok.trim() !== "" && targets.has(tok.toLowerCase());

  if (targets.size === 0 || !tokens.some(isMatch)) {
    ctx.font = baseFont;
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
    return;
  }

  const inkTop = y + size * 0.16;
  const inkBottom = y + size * 0.92;
  const padX = size * 0.24;
  const padY = size * 0.14;
  const underT = Math.max(2, size * 0.08);

  // First pass (marker only): draw the filled block(s) behind contiguous runs of
  // matched words so text sits on top. We measure token widths to place them.
  const widths = tokens.map((tok) => {
    ctx.font = isMatch(tok) && (style === "bold" || style === "glow" || style === "underline") ? boldFont : baseFont;
    return ctx.measureText(tok).width;
  });

  if (style === "marker") {
    let cx = x;
    let runStart = -1;
    let runW = 0;
    const flush = (endX: number) => {
      if (runStart < 0) return;
      ctx.font = baseFont;
      ctx.fillStyle = accentColor;
      drawRoundedRect(ctx, runStart - padX, inkTop - padY, runW + padX * 2, inkBottom - inkTop + padY * 2, size * 0.18);
      ctx.fill();
      runStart = -1;
      runW = 0;
      void endX;
    };
    for (let i = 0; i < tokens.length; i++) {
      const w = widths[i];
      if (isMatch(tokens[i])) {
        if (runStart < 0) runStart = cx;
        runW += w;
      } else if (tokens[i].trim() === "" && runStart >= 0) {
        // whitespace inside a run keeps the block continuous
        runW += w;
      } else {
        flush(cx);
      }
      cx += w;
    }
    flush(cx);
  }

  // Second pass: draw all text, styling matched words.
  let cx = x;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const w = widths[i];
    if (isMatch(tok)) {
      if (style === "marker") {
        ctx.font = baseFont;
        ctx.fillStyle = markerTextColor;
        ctx.fillText(tok, cx, y);
      } else if (style === "underline") {
        ctx.font = boldFont;
        ctx.fillStyle = accentColor;
        ctx.fillText(tok, cx, y);
        ctx.fillRect(cx, y + size * 0.98, w, underT);
      } else if (style === "glow") {
        ctx.font = boldFont;
        ctx.save();
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = size * 0.5;
        ctx.fillStyle = accentColor;
        ctx.fillText(tok, cx, y);
        ctx.fillText(tok, cx, y);
        ctx.restore();
      } else {
        // bold
        ctx.font = boldFont;
        ctx.fillStyle = accentColor;
        ctx.fillText(tok, cx, y);
      }
    } else {
      ctx.font = baseFont;
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.95;
      ctx.fillText(tok, cx, y);
      ctx.globalAlpha = 1;
    }
    cx += w;
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// A bottom contact strip: a translucent band with website + phone, and an
// optional filled CTA pill on the right. Mirrors the reference business banners.
// Returns the height it consumed so the content block can sit above it.
function drawContactBar(
  ctx: CanvasRenderingContext2D,
  bar: ContactBar,
  W: number,
  H: number,
  accent: string,
  textColor: string,
  bodyFamily: string,
): number {
  const hasAny = Boolean(bar.website?.trim() || bar.phone?.trim() || bar.cta?.trim());
  if (!hasAny) return 0;

  const barH = Math.round(H * 0.16);
  const y = H - barH;
  const fontSize = Math.max(11, Math.round(barH * 0.34));
  const padX = Math.round(W * 0.03);

  // Band — a subtle dark translucent strip so it reads on any background.
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, y, W, barH);
  // thin accent rule on top of the band
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, y, W, Math.max(2, Math.round(barH * 0.04)));
  ctx.globalAlpha = 1;

  ctx.font = `600 ${fontSize}px ${bodyFamily}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = textColor;
  const midY = y + barH / 2;

  let cx = padX;
  if (bar.website?.trim()) {
    const t = bar.website.trim();
    ctx.fillText(t, cx, midY);
    cx += ctx.measureText(t).width + Math.round(W * 0.03);
  }
  if (bar.phone?.trim()) {
    const t = bar.phone.trim();
    ctx.fillText(t, cx, midY);
  }

  // CTA pill, right-aligned.
  if (bar.cta?.trim()) {
    const label = bar.cta.trim();
    ctx.font = `700 ${fontSize}px ${bodyFamily}`;
    const tw = ctx.measureText(label).width;
    const pillPadX = fontSize * 0.9;
    const pillH = barH * 0.62;
    const pillW = tw + pillPadX * 2;
    const px = W - padX - pillW;
    const py = midY - pillH / 2;
    ctx.fillStyle = accent;
    drawRoundedRect(ctx, px, py, pillW, pillH, pillH / 2);
    ctx.fill();
    // readable pill text: pick black/white against the accent
    ctx.fillStyle = accentReadableText(accent);
    ctx.textAlign = "left";
    ctx.fillText(label, px + pillPadX, midY);
  }
  ctx.restore();
  return barH;
}

// Best readable text (black/white) on a filled accent color.
function accentReadableText(accent: string): string {
  const { r, g, b } = hexToRgb(accent);
  // simple luminance
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.6 ? "#111111" : "#ffffff";
}

// Draw a photo into one side of the banner behind a shaped divider (straight,
// diagonal, or curve). The photo zone is clipped; the other zone keeps the
// painted background so text sits on solid color. Returns the x-range [textX0,
// textX1] the CONTENT should stay within (the non-photo zone, with padding).
function paintPhotoPanel(
  ctx: CanvasRenderingContext2D,
  photo: HTMLImageElement,
  spec: PhotoPanelSpec,
  W: number,
  H: number,
  pad: number,
): { textX0: number; textX1: number } {
  // The photo occupies ~42% of the width on its side. The divider is drawn as a
  // clip path so the photo edge takes the chosen shape.
  const photoFrac = 0.42;
  const seam = spec.side === "left" ? W * photoFrac : W * (1 - photoFrac);
  const skew = W * 0.05; // how far the diagonal/curve leans

  ctx.save();
  ctx.beginPath();
  if (spec.side === "left") {
    ctx.moveTo(0, 0);
    if (spec.divider === "straight") {
      ctx.lineTo(seam, 0);
      ctx.lineTo(seam, H);
    } else if (spec.divider === "diagonal") {
      ctx.lineTo(seam + skew, 0);
      ctx.lineTo(seam - skew, H);
    } else {
      // curve
      ctx.lineTo(seam, 0);
      ctx.bezierCurveTo(seam - skew, H * 0.35, seam + skew, H * 0.65, seam, H);
    }
    ctx.lineTo(0, H);
  } else {
    ctx.moveTo(W, 0);
    if (spec.divider === "straight") {
      ctx.lineTo(seam, 0);
      ctx.lineTo(seam, H);
    } else if (spec.divider === "diagonal") {
      ctx.lineTo(seam - skew, 0);
      ctx.lineTo(seam + skew, H);
    } else {
      ctx.lineTo(seam, 0);
      ctx.bezierCurveTo(seam + skew, H * 0.35, seam - skew, H * 0.65, seam, H);
    }
    ctx.lineTo(W, H);
  }
  ctx.closePath();
  ctx.clip();

  // Cover the photo zone, then offset by the focal point and zoom. The zone the
  // photo needs to fill is its side of the seam (its visible box), so the crop
  // and focal math work against that box, not the whole banner.
  const zoneX0 = spec.side === "left" ? 0 : Math.min(seam, seam);
  const zoneW = spec.side === "left" ? seam + skew : W - (seam - skew);
  const boxX = spec.side === "left" ? 0 : W - zoneW;

  const zoom = Math.max(1, spec.zoom ?? 1);
  const focusX = clamp01(spec.focusX ?? 0.5);
  const focusY = clamp01(spec.focusY ?? 0.4); // bias slightly toward faces by default
  void zoneX0;

  const cover = Math.max(zoneW / photo.width, H / photo.height);
  const scale = cover * zoom;
  const dw = photo.width * scale;
  const dh = photo.height * scale;
  // Position so the focal point of the photo aligns with the focal point of the
  // box, then clamp so we never reveal an empty edge.
  let dx = boxX + focusX * zoneW - focusX * dw;
  let dy = focusY * H - focusY * dh;
  dx = Math.min(boxX, Math.max(boxX + zoneW - dw, dx));
  dy = Math.min(0, Math.max(H - dh, dy));

  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();

  // Content stays in the non-photo zone. Use a tighter content pad than the
  // banner pad (which is tuned for full-width layouts) so text isn't squeezed —
  // and only clear the seam by a small margin, not the full skew, so we close
  // the gap on the photo side and gain room before the right edge.
  const contentPad = Math.round(pad * 0.5);
  const seamClear = skew * 0.5;
  if (spec.side === "left") {
    return { textX0: seam + seamClear + contentPad, textX1: W - contentPad };
  }
  return { textX0: contentPad, textX1: seam - seamClear - contentPad };
}

export async function renderSocial(opts: SocialOpts): Promise<HTMLCanvasElement> {
  const font = getFontPair(opts.design.fontId);
  await ensureFontFor(font);
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const logoImg = await paintCanvasLayers(ctx, W, H, opts.background, opts.design, opts.logoDataUrl, true);

  const padding = 80;
  const textColor = opts.textColor;
  const eyebrow = opts.design.eyebrow?.trim();
  const eyebrowSize = 24;
  const eyebrowGap = 22;
  ctx.fillStyle = textColor;

  if (opts.layout === "centered") {
    const maxW = W - padding * 2;
    if (logoImg) {
      const lh = 88;
      const lw = (logoImg.width / logoImg.height) * lh;
      ctx.drawImage(logoImg, (W - lw) / 2, padding, lw, lh);
    }
    let yStart = logoImg ? padding + 88 + 52 : H / 2 - 110;
    if (eyebrow) {
      drawEyebrow(ctx, eyebrow, W / 2, yStart, eyebrowSize, textColor, font.bodyFamily, "center");
      yStart += eyebrowSize + eyebrowGap;
    }
    const { size, lines } = fitHeadline(ctx, opts.headline || " ", maxW, 3, 96, 40, font.headingFamily, font.headingWeight);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = textColor;
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, yStart + i * size * 1.15));
    if (opts.subhead) {
      ctx.font = `${font.bodyWeight} 32px ${font.bodyFamily}`;
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.subhead, W / 2, yStart + lines.length * size * 1.15 + 24);
      ctx.globalAlpha = 1;
    }
  } else if (opts.layout === "logo-tl") {
    const maxW = W - padding * 2;
    if (logoImg) {
      const lh = 72;
      const lw = (logoImg.width / logoImg.height) * lh;
      ctx.drawImage(logoImg, padding, padding, lw, lh);
    }
    const { size, lines } = fitHeadline(ctx, opts.headline || " ", maxW, 3, 88, 36, font.headingFamily, font.headingWeight);
    const eyebrowH = eyebrow ? eyebrowSize + eyebrowGap : 0;
    const totalH = eyebrowH + lines.length * size * 1.15 + (opts.subhead ? 60 : 0);
    let y = (H - totalH) / 2 + 20;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (eyebrow) {
      drawEyebrow(ctx, eyebrow, padding, y, eyebrowSize, textColor, font.bodyFamily, "left");
      y += eyebrowSize + eyebrowGap;
    }
    ctx.fillStyle = textColor;
    lines.forEach((ln, i) => ctx.fillText(ln, padding, y + i * size * 1.15));
    if (opts.subhead) {
      ctx.font = `${font.bodyWeight} 30px ${font.bodyFamily}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.subhead, padding, y + lines.length * size * 1.15 + 24);
      ctx.globalAlpha = 1;
    }
  } else {
    // split: text left column, logo on the right. The name is the HERO and must
    // dominate — cap it to 2 lines and let it run LARGE (up to ~112px) with a
    // high floor, so the eyebrow (small caps) and tagline read as clearly
    // subordinate. Line-height is tight (1.04) so a two-line name reads as one
    // strong block, not two loose rows. This is what fixes the "nothing stands
    // out" flatness on the split card.
    const colW = W * 0.54 - padding;
    const { size, lines } = fitHeadline(ctx, opts.headline || " ", colW, 2, 112, 56, font.headingFamily, font.headingWeight);
    const nameLead = size * 1.04;
    const eyebrowH = eyebrow ? eyebrowSize + eyebrowGap : 0;
    const tagGap = 28;
    const tagSize = 30;
    const totalH =
      eyebrowH + lines.length * nameLead + (opts.subhead ? tagGap + tagSize : 0);
    let y = (H - totalH) / 2;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    if (eyebrow) {
      drawEyebrow(ctx, eyebrow, padding, y, eyebrowSize, textColor, font.bodyFamily, "left");
      y += eyebrowSize + eyebrowGap;
    }
    ctx.font = `${font.headingWeight} ${size}px ${font.headingFamily}`;
    ctx.fillStyle = textColor;
    lines.forEach((ln, i) => ctx.fillText(ln, padding, y + i * nameLead));
    y += lines.length * nameLead;
    if (opts.subhead) {
      ctx.font = `${font.bodyWeight} ${tagSize}px ${font.bodyFamily}`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.subhead, padding, y + tagGap);
      ctx.globalAlpha = 1;
    }
    if (logoImg) {
      const maxLogo = Math.min(330, H - padding * 2);
      const ratio = Math.min(maxLogo / logoImg.width, maxLogo / logoImg.height);
      const lw = logoImg.width * ratio;
      const lh = logoImg.height * ratio;
      ctx.drawImage(logoImg, W * 0.78 - lw / 2, H / 2 - lh / 2, lw, lh);
    }
  }

  return canvas;
}

// ===== Social profile banners =====
// The three cover/banner sizes a brand kit is expected to ship. These are wide,
// short strips whose "safe zone" (the area not cropped by the round avatar or a
// centered card frame) differs per platform, so we frame content toward the
// side/center that stays visible rather than the OG image's full-bleed center.

export interface BannerSize {
  id: BannerPlatform;
  label: string;
  w: number;
  h: number;
  file: string;
}

export type BannerPlatform = "linkedin" | "facebook" | "twitter";

export const BANNER_SIZES: BannerSize[] = [
  { id: "linkedin", label: "LinkedIn", w: 1584, h: 396, file: "linkedin-banner.png" },
  { id: "facebook", label: "Facebook", w: 820, h: 312, file: "facebook-cover.png" },
  { id: "twitter", label: "Twitter / X", w: 1500, h: 500, file: "twitter-header.png" },
];

export type BannerLayout = "left" | "centered" | "photo-panel" | "highlight";

/** A photo carved into one side of the banner behind a shaped divider. */
export interface PhotoPanelSpec {
  dataUrl: string;
  side: "left" | "right";
  divider: "straight" | "diagonal" | "curve";
  /** Zoom multiplier on the cover scale (1 = fill, >1 = punch in). Default 1. */
  zoom?: number;
  /** Focal point 0..1 — which part of the photo stays visible when cropped. */
  focusX?: number; // 0 = left edge, 1 = right edge
  focusY?: number; // 0 = top edge, 1 = bottom edge
}

/** An optional business contact strip along the bottom edge. */
export interface ContactBar {
  website?: string;
  phone?: string;
  cta?: string; // e.g. "Get Started" — rendered as a filled pill
}

export interface BannerOpts {
  size: BannerSize;
  name: string;
  tagline: string;
  logoDataUrl?: string;
  background: SocialBg;
  layout: BannerLayout;
  textColor: string;
  design: DesignLayers;
  /** Present only for the photo-panel layout. */
  photo?: PhotoPanelSpec;
  /** Words in the tagline (or name) to spotlight. */
  highlightPhrase?: string;
  /** How the spotlighted words are emphasized. Default "bold". */
  highlightStyle?: HighlightStyle;
  /** Optional bottom contact strip — website / phone / CTA pill. */
  contactBar?: ContactBar;
}

// Load + rasterize the pairing's weights before drawing (async <link>). Keeps
// preview and export identical. Falls back through ensureInter for safety.
async function ensureFontFor(font: FontPair): Promise<void> {
  await ensureInter();
  await ensureFontLoaded(font);
}

// A left-aligned content block: optional logo, then eyebrow → name → tagline,
// vertically centered at `midY` inside the x-range [x0, x1]. The tagline honors
// a highlight phrase (accent marker block). Used by the photo-panel and
// highlight layouts, which both anchor content to a column rather than center.
interface LeftBlockArgs {
  x0: number;
  x1: number;
  midY: number;
  font: FontPair;
  textColor: string;
  accent: string;
  eyebrow: string;
  name: string;
  tagline: string;
  highlight: string;
  highlightStyle: HighlightStyle;
  sizes: { nameMax: number; nameMin: number; tagSize: number; eyebrowSize: number };
  H: number;
  logoImg: HTMLImageElement | null;
  logoH: number;
  /** Top edge the stack must not cross (top padding). Defaults to H*0.08. */
  topLimit?: number;
  /** Bottom edge the stack must not cross (above avatar/contact bar). Defaults to H. */
  bottomLimit?: number;
}

function drawLeftContentBlock(ctx: CanvasRenderingContext2D, a: LeftBlockArgs) {
  const { font, textColor, accent } = a;
  const maxW = a.x1 - a.x0;
  const hasEyebrow = Boolean(a.eyebrow);
  const hasName = Boolean(a.name);
  const hasTag = Boolean(a.tagline);
  const showLogo = a.logoImg != null;
  let logoGap = Math.round(a.H * 0.05);
  let gap = Math.round(a.H * 0.045);
  let eyebrowGap = Math.round(a.H * 0.03);

  let nameSize = 0;
  let nameLines: string[] = [];
  if (hasName) {
    const fit = fitHeadline(ctx, a.name, maxW, 2, a.sizes.nameMax, a.sizes.nameMin, font.headingFamily, font.headingWeight);
    nameSize = fit.size;
    nameLines = fit.lines;
  }
  let nameBlockH = nameLines.length * nameSize * 1.08;
  let logoDrawH = showLogo ? a.logoH * 0.7 : 0;
  // Mutable copies of the type sizes so the fit-to-band pass below can shrink
  // the whole stack uniformly when it's taller than the space it has.
  let eyebrowSize = a.sizes.eyebrowSize;
  let tagSize = a.sizes.tagSize;

  // Wrap the tagline to up to 2 lines within the zone so a long tagline on a
  // narrow layout (Facebook photo panel) reflows instead of running off the
  // edge — no hard character cap, so wide banners keep it on one line.
  // `highlight` is a "|"-joined list of selected words; a line "has" the
  // highlight when any of those words appears in it as a whole word.
  const hlWords = a.highlight
    .split("|")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const lineHasHl = (line: string) => {
    const set = new Set(line.split(/\s+/).map((w) => w.toLowerCase()));
    return hlWords.some((w) => set.has(w));
  };
  const nameHasHl = hlWords.length > 0 && hasName && nameLines.length === 1 && lineHasHl(a.name);
  const tagHasHl = hlWords.length > 0 && hasTag && !nameHasHl && lineHasHl(a.tagline);
  let tagLines: string[] = hasTag ? [a.tagline] : [];
  if (hasTag && !tagHasHl) {
    // Only wrap the plain tagline; a highlighted tagline stays one line so the
    // marker/emphasis math (single-line) holds.
    ctx.font = `${font.bodyWeight} ${tagSize}px ${font.bodyFamily}`;
    tagLines = wrapLines(ctx, a.tagline, maxW, 2);
    if (tagLines.length === 0) tagLines = [a.tagline];
  }
  let tagBlockH = tagLines.length * tagSize * 1.18;

  const stackH = () =>
    (showLogo ? logoDrawH + logoGap : 0) +
    (hasEyebrow ? eyebrowSize + eyebrowGap : 0) +
    (hasName ? nameBlockH : 0) +
    (hasName && hasTag ? gap : 0) +
    (hasTag ? tagBlockH : 0);

  // ── Fit the whole stack to the band ────────────────────────────────────────
  // The block is vertically centered at midY. If it's taller than the space it
  // has (top padding → bottom limit), scale EVERYTHING down together — logo,
  // type and gaps — so a long name with a logo + tagline never pushes the logo
  // off the top or the tagline into the avatar. This is the fix for the banners
  // clipping the logo when the content is tall.
  const topLimit = a.topLimit ?? Math.round(a.H * 0.08);
  const bottomLimit = a.bottomLimit ?? a.H;
  const avail = bottomLimit - topLimit;
  const scale = stackH() > avail ? avail / stackH() : 1;
  if (scale < 1) {
    logoDrawH *= scale;
    nameSize *= scale;
    nameBlockH *= scale;
    tagSize *= scale;
    tagBlockH *= scale;
    eyebrowSize *= scale;
    logoGap = Math.round(logoGap * scale);
    gap = Math.round(gap * scale);
    eyebrowGap = Math.round(eyebrowGap * scale);
  }

  const blockH = stackH();
  // Center at midY, then clamp so the top never crosses topLimit and the bottom
  // never crosses bottomLimit (with the block now guaranteed to fit, one clamp
  // resolves both).
  let y = a.midY - blockH / 2;
  if (y < topLimit) y = topLimit;
  if (y + blockH > bottomLimit) y = bottomLimit - blockH;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  if (showLogo && a.logoImg) {
    const lw = (a.logoImg.width / a.logoImg.height) * logoDrawH;
    ctx.drawImage(a.logoImg, a.x0, y, lw, logoDrawH);
    y += logoDrawH + logoGap;
  }
  if (hasEyebrow) {
    drawEyebrow(ctx, a.eyebrow, a.x0, y, eyebrowSize, textColor, font.bodyFamily, "left");
    y += eyebrowSize + eyebrowGap;
  }
  // Highlight lives in the NAME (big hero line) when it's a single line, else
  // the tagline. Computed above so tagline wrapping can skip a highlighted
  // tagline (which must stay one line for the marker math).

  if (hasName) {
    if (nameHasHl) {
      drawHighlightedLine(
        ctx,
        nameLines[0],
        a.highlight,
        a.x0,
        y,
        nameSize,
        font.headingFamily,
        font.headingWeight,
        textColor,
        accent,
        accentReadableText(accent),
        a.highlightStyle,
      );
    } else {
      ctx.font = `${font.headingWeight} ${nameSize}px ${font.headingFamily}`;
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      nameLines.forEach((ln, i) => ctx.fillText(ln, a.x0, y + i * nameSize * 1.08));
    }
    y += nameBlockH + gap;
  }
  if (hasTag) {
    if (tagHasHl) {
      drawHighlightedLine(
        ctx,
        a.tagline,
        a.highlight,
        a.x0,
        y,
        tagSize,
        font.bodyFamily,
        font.bodyWeight,
        textColor,
        accent,
        accentReadableText(accent),
        a.highlightStyle,
      );
    } else {
      ctx.font = `${font.bodyWeight} ${tagSize}px ${font.bodyFamily}`;
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.9;
      tagLines.forEach((ln, i) => ctx.fillText(ln, a.x0, y + i * tagSize * 1.18));
      ctx.globalAlpha = 1;
    }
  }
}

export async function renderBanner(opts: BannerOpts): Promise<HTMLCanvasElement> {
  const font = getFontPair(opts.design.fontId);
  await ensureFontFor(font);
  const { w: W, h: H } = opts.size;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Banners take solid/gradient only — a photo behind a thin strip reads badly.
  // paintCanvasLayers with allowPhoto=false falls back to the accent solid.
  const logoImg = await paintCanvasLayers(ctx, W, H, opts.background, opts.design, opts.logoDataUrl, false);

  // Scale paddings/type off the (short) height so all three sizes look consistent.
  const pad = Math.round(H * 0.16);
  const textColor = opts.textColor;
  const accent = opts.design.accentColor;

  const hasName = Boolean(opts.name.trim());
  const hasTag = Boolean(opts.tagline.trim());
  const eyebrow = opts.design.eyebrow?.trim();
  const hasEyebrow = Boolean(eyebrow);
  const nameMax = Math.round(H * 0.26);
  const nameMin = Math.round(H * 0.12);
  const tagSize = Math.max(14, Math.round(H * 0.075));
  const eyebrowSize = Math.max(11, Math.round(H * 0.05));
  const logoH = Math.round(H * 0.42);
  const highlight = opts.highlightPhrase?.trim() || "";

  // ---- Photo panel ----
  // For the photo-panel layout, carve the photo into one side behind a shaped
  // divider and constrain content to the solid zone it returns.
  let photoZone: { textX0: number; textX1: number } | null = null;
  if (opts.layout === "photo-panel" && opts.photo?.dataUrl) {
    try {
      const photoImg = await loadImage(opts.photo.dataUrl);
      // The solid (text) zone already carries the background + texture from
      // paintCanvasLayers; the photo is drawn over its own zone, so we do NOT
      // re-apply texture (it would land on the person's face).
      photoZone = paintPhotoPanel(ctx, photoImg, opts.photo, W, H, pad);
    } catch {
      photoZone = null;
    }
  }

  // ---- Contact bar (independent add-on, any layout) ----
  // Drawn first so we know how much bottom space it reserves, then content is
  // biased to sit above it.
  const contactH = opts.contactBar
    ? drawContactBar(ctx, opts.contactBar, W, H, accent, textColor, font.bodyFamily)
    : 0;

  // ---- Safe zone ----
  // All three platforms overlay a round profile avatar in the BOTTOM-LEFT of the
  // banner, plus each crops differently. The single biggest quality tell is
  // keeping the logo/name/tagline clear of that avatar. AVATAR_SAFE (shared with
  // the preview overlay in social-design.ts) is the horizontal fraction the
  // avatar+margin reserve; "left" content starts right of it and sits high.
  const avatarSafeX = Math.round(W * AVATAR_SAFE[opts.size.id]);
  // Vertical anchor: bias content upward so it clears the bottom avatar band AND
  // the contact bar (if present, center the content in the space above the bar).
  const safeMidY = contactH > 0 ? (H - contactH) * 0.46 : H * 0.42;

  // Vertical band the content stack must fit inside. Top = a small top padding;
  // bottom = above the contact bar (with a little breathing room). Every layout
  // scales its stack to fit this band so a tall logo+name+tagline never clips.
  const bandTop = Math.round(H * 0.08);
  const bandBottom = H - contactH - Math.round(H * 0.06);

  ctx.fillStyle = textColor;

  if (opts.layout === "photo-panel") {
    // Left-style content constrained to the solid (non-photo) zone. Highlight is
    // reserved for the Highlight layout, so it stays OFF here (photo layouts
    // shouldn't spotlight words unless the user chose the Highlight layout).
    const zone = photoZone ?? { textX0: Math.max(pad, avatarSafeX), textX1: W - pad };
    drawLeftContentBlock(ctx, {
      x0: zone.textX0,
      x1: zone.textX1,
      midY: safeMidY,
      font,
      textColor,
      accent,
      eyebrow: hasEyebrow ? eyebrow! : "",
      name: opts.name.trim(),
      tagline: opts.tagline.trim(),
      highlight: "",
      highlightStyle: opts.highlightStyle ?? "bold",
      sizes: { nameMax, nameMin, tagSize, eyebrowSize },
      H,
      logoImg,
      logoH,
      topLimit: bandTop,
      bottomLimit: bandBottom,
    });
  } else if (opts.layout === "highlight") {
    // Text-forward: eyebrow → name → highlighted tagline, left-aligned in the
    // full safe width. The marker block is the hero move, so bump the tagline
    // size here (a small tagline marker reads as nothing).
    const startX = Math.max(pad, avatarSafeX);
    const heroTag = Math.max(tagSize, Math.round(H * 0.12));
    drawLeftContentBlock(ctx, {
      x0: startX,
      x1: W - pad,
      midY: safeMidY,
      font,
      textColor,
      accent,
      eyebrow: hasEyebrow ? eyebrow! : "",
      name: opts.name.trim(),
      tagline: opts.tagline.trim(),
      highlight,
      highlightStyle: opts.highlightStyle ?? "bold",
      sizes: { nameMax, nameMin, tagSize: heroTag, eyebrowSize },
      H,
      logoImg,
      logoH,
      topLimit: bandTop,
      bottomLimit: bandBottom,
    });
  } else if (opts.layout === "centered") {
    // Centered horizontally (avatar hugs the far-left edge, so true-center text
    // clears it) but biased UP so it sits above the bottom-left avatar band.
    const maxW = W * 0.7;
    let eyebrowGap = Math.round(H * 0.035);
    let cEyebrowSize = eyebrowSize;
    let cTagSize = tagSize;
    let cLogoH = logoH;
    let nameSize = 0;
    let nameLines: string[] = [];
    if (hasName) {
      const fit = fitHeadline(ctx, opts.name.trim(), maxW, 1, nameMax, nameMin, font.headingFamily, font.headingWeight);
      nameSize = fit.size;
      nameLines = fit.lines;
    }
    let gap = Math.round(H * 0.06);
    const centeredStackH = () =>
      (logoImg ? cLogoH + gap : 0) +
      (hasEyebrow ? cEyebrowSize + eyebrowGap : 0) +
      (hasName ? nameSize + (hasTag ? gap : 0) : 0) +
      (hasTag ? cTagSize : 0);
    // Fit the stack to the band (same idea as the left block).
    const cScale = centeredStackH() > bandBottom - bandTop ? (bandBottom - bandTop) / centeredStackH() : 1;
    if (cScale < 1) {
      cLogoH *= cScale;
      cEyebrowSize *= cScale;
      cTagSize *= cScale;
      nameSize *= cScale;
      gap = Math.round(gap * cScale);
      eyebrowGap = Math.round(eyebrowGap * cScale);
    }
    const totalH = centeredStackH();
    let cursorY = safeMidY - totalH / 2;
    if (cursorY < bandTop) cursorY = bandTop;
    if (cursorY + totalH > bandBottom) cursorY = bandBottom - totalH;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (logoImg) {
      const lw = (logoImg.width / logoImg.height) * cLogoH;
      ctx.drawImage(logoImg, W / 2 - lw / 2, cursorY, lw, cLogoH);
      cursorY += cLogoH + gap;
    }
    if (hasEyebrow) {
      drawEyebrow(ctx, eyebrow!, W / 2, cursorY, cEyebrowSize, textColor, font.bodyFamily, "center");
      cursorY += cEyebrowSize + eyebrowGap;
    }
    if (hasName) {
      ctx.font = `${font.headingWeight} ${nameSize}px ${font.headingFamily}`;
      ctx.textAlign = "center";
      ctx.fillStyle = textColor;
      ctx.fillText(nameLines[0] ?? opts.name.trim(), W / 2, cursorY);
      cursorY += nameSize + gap;
    }
    if (hasTag) {
      ctx.font = `${font.bodyWeight} ${cTagSize}px ${font.bodyFamily}`;
      ctx.textAlign = "center";
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.tagline.trim(), W / 2, cursorY);
      ctx.globalAlpha = 1;
    }
  } else {
    // Left layout: logo + name + tagline, left-aligned, but starting to the RIGHT
    // of the avatar-safe column and biased upward — so the bottom-left avatar
    // never lands on top of the brand. This is the safe-zone-correct default.
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const startX = Math.max(pad, avatarSafeX);
    const maxW = W - startX - pad;
    let x = startX;

    // Logo sits beside the text, vertically centered. Cap its height to the band
    // so it never bleeds past the top/bottom, and cap its WIDTH to a third of the
    // usable row so a wide logo can't crowd the name off the right edge.
    if (logoImg) {
      let leftLogoH = Math.min(logoH, bandBottom - bandTop);
      const logoAspect = logoImg.width / logoImg.height;
      const maxLogoW = maxW * 0.34;
      if (leftLogoH * logoAspect > maxLogoW) leftLogoH = maxLogoW / logoAspect;
      const lw = logoAspect * leftLogoH;
      let logoY = safeMidY - leftLogoH / 2;
      if (logoY < bandTop) logoY = bandTop;
      if (logoY + leftLogoH > bandBottom) logoY = bandBottom - leftLogoH;
      ctx.drawImage(logoImg, x, logoY, lw, leftLogoH);
      x += lw + Math.round(H * 0.12);
    }

    let nameSize = 0;
    let nameLines: string[] = [];
    if (hasName) {
      const fit = fitHeadline(ctx, opts.name.trim(), maxW - (x - startX), 1, nameMax, nameMin, font.headingFamily, font.headingWeight);
      nameSize = fit.size;
      nameLines = fit.lines;
    }
    const gap = Math.round(H * 0.05);
    const eyebrowGap = Math.round(H * 0.03);
    const blockH =
      (hasEyebrow ? eyebrowSize + eyebrowGap : 0) +
      (hasName ? nameSize : 0) +
      (hasName && hasTag ? gap : 0) +
      (hasTag ? tagSize : 0);
    let y = safeMidY - blockH / 2;
    if (hasEyebrow) {
      drawEyebrow(ctx, eyebrow!, x, y, eyebrowSize, textColor, font.bodyFamily, "left");
      y += eyebrowSize + eyebrowGap;
    }
    if (hasName) {
      ctx.font = `${font.headingWeight} ${nameSize}px ${font.headingFamily}`;
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.fillText(nameLines[0] ?? opts.name.trim(), x, y);
      y += nameSize + gap;
    }
    if (hasTag) {
      ctx.font = `${font.bodyWeight} ${tagSize}px ${font.bodyFamily}`;
      ctx.textAlign = "left";
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.tagline.trim(), x, y);
      ctx.globalAlpha = 1;
    }
  }

  return canvas;
}