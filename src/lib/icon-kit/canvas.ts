// Canvas rendering helpers for Icon Kit. All client-side.
//
// The social/banner rendering engine (renderSocial / renderBanner and its font
// pairing usage) was forked out to the standalone Banner Designer tool; the
// dead code and its `./social-design` + shared-fonts dependency were removed
// here. What remains is the icon/favicon rendering Icon Kit actually ships.

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
