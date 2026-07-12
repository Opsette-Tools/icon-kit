// Canvas rendering helpers for Icon Kit. All client-side.

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
  | { type: "image"; dataUrl: string; overlay: number };

export interface SocialOpts {
  headline: string;
  subhead: string;
  logoDataUrl?: string;
  background: SocialBg;
  layout: SocialLayout;
  textColor: string;
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

function fitHeadline(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, max: number, min: number) {
  let lo = min;
  let hi = max;
  let best = min;
  let bestLines: string[] = [text];
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    ctx.font = `800 ${mid}px "Inter", system-ui, sans-serif`;
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
  ctx.font = `800 ${best}px "Inter", system-ui, sans-serif`;
  return { size: best, lines: bestLines };
}

export async function renderSocial(opts: SocialOpts): Promise<HTMLCanvasElement> {
  await ensureInter();
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = opts.background;
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === "gradient") {
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
  } else if (bg.type === "image") {
    try {
      const img = await loadImage(bg.dataUrl);
      // cover
      const ratio = Math.max(W / img.width, H / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.fillStyle = `rgba(0,0,0,${bg.overlay})`;
      ctx.fillRect(0, 0, W, H);
    } catch {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, W, H);
    }
  }

  const padding = 80;
  const textColor = opts.textColor;
  ctx.fillStyle = textColor;

  let logoImg: HTMLImageElement | null = null;
  if (opts.logoDataUrl) {
    try {
      logoImg = await loadImage(opts.logoDataUrl);
    } catch {
      logoImg = null;
    }
  }

  if (opts.layout === "centered") {
    const maxW = W - padding * 2;
    if (logoImg) {
      const lh = 88;
      const lw = (logoImg.width / logoImg.height) * lh;
      ctx.drawImage(logoImg, (W - lw) / 2, padding, lw, lh);
    }
    const yStart = logoImg ? padding + 88 + 60 : H / 2 - 100;
    const { size, lines } = fitHeadline(ctx, opts.headline || " ", maxW, 3, 96, 40);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = textColor;
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, yStart + i * size * 1.15));
    if (opts.subhead) {
      ctx.font = `500 32px "Inter", system-ui, sans-serif`;
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
    const { size, lines } = fitHeadline(ctx, opts.headline || " ", maxW, 3, 88, 36);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const totalH = lines.length * size * 1.15 + (opts.subhead ? 60 : 0);
    let y = (H - totalH) / 2 + 20;
    ctx.fillStyle = textColor;
    lines.forEach((ln, i) => ctx.fillText(ln, padding, y + i * size * 1.15));
    if (opts.subhead) {
      ctx.font = `500 30px "Inter", system-ui, sans-serif`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.subhead, padding, y + lines.length * size * 1.15 + 24);
      ctx.globalAlpha = 1;
    }
  } else {
    // split: text left half, logo big right half
    const colW = W / 2 - padding * 1.5;
    const { size, lines } = fitHeadline(ctx, opts.headline || " ", colW, 4, 80, 32);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const totalH = lines.length * size * 1.15 + (opts.subhead ? 60 : 0);
    let y = (H - totalH) / 2;
    ctx.fillStyle = textColor;
    lines.forEach((ln, i) => ctx.fillText(ln, padding, y + i * size * 1.15));
    if (opts.subhead) {
      ctx.font = `500 28px "Inter", system-ui, sans-serif`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.subhead, padding, y + lines.length * size * 1.15 + 24);
      ctx.globalAlpha = 1;
    }
    if (logoImg) {
      const maxLogo = Math.min(360, H - padding * 2);
      const ratio = Math.min(maxLogo / logoImg.width, maxLogo / logoImg.height);
      const lw = logoImg.width * ratio;
      const lh = logoImg.height * ratio;
      ctx.drawImage(logoImg, W * 0.75 - lw / 2, H / 2 - lh / 2, lw, lh);
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

export type BannerLayout = "left" | "centered";

export interface BannerOpts {
  size: BannerSize;
  name: string;
  tagline: string;
  logoDataUrl?: string;
  background: SocialBg;
  layout: BannerLayout;
  textColor: string;
}

function paintBackground(ctx: CanvasRenderingContext2D, bg: SocialBg, W: number, H: number) {
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === "gradient") {
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
}

export async function renderBanner(opts: BannerOpts): Promise<HTMLCanvasElement> {
  await ensureInter();
  const { w: W, h: H } = opts.size;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const bg = opts.background;
  if (bg.type === "image") {
    // Banners take solid/gradient only; fall back to solid if an image slips in.
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, W, H);
  } else {
    paintBackground(ctx, bg, W, H);
  }

  // Scale paddings/type off the (short) height so all three sizes look consistent.
  const pad = Math.round(H * 0.16);
  const textColor = opts.textColor;

  let logoImg: HTMLImageElement | null = null;
  if (opts.logoDataUrl) {
    try {
      logoImg = await loadImage(opts.logoDataUrl);
    } catch {
      logoImg = null;
    }
  }

  const hasName = Boolean(opts.name.trim());
  const hasTag = Boolean(opts.tagline.trim());
  const nameMax = Math.round(H * 0.26);
  const nameMin = Math.round(H * 0.12);
  const tagSize = Math.max(14, Math.round(H * 0.075));
  const logoH = Math.round(H * 0.42);

  // ---- Safe zone ----
  // All three platforms overlay a round profile avatar in the BOTTOM-LEFT of the
  // banner, plus each crops differently. The single biggest quality tell is
  // keeping the logo/name/tagline clear of that avatar. `avatarSafe` is the
  // horizontal width (from the left edge) the avatar+its margin occupy; content
  // in the "left" layout starts to the right of it, and the whole block sits in
  // the upper 2/3 so it never collides with the bottom-left circle.
  const AVATAR_SAFE: Record<BannerPlatform, number> = {
    // fraction of width the bottom-left avatar + breathing room reserves
    linkedin: 0.14,
    facebook: 0.22,
    twitter: 0.16,
  };
  const avatarSafeX = Math.round(W * AVATAR_SAFE[opts.size.id]);
  // Vertical anchor: bias content upward so it clears the bottom avatar band.
  const safeMidY = H * 0.42;

  ctx.fillStyle = textColor;

  if (opts.layout === "centered") {
    // Centered horizontally (avatar hugs the far-left edge, so true-center text
    // clears it) but biased UP so it sits above the bottom-left avatar band.
    const maxW = W * 0.7;
    const blocks: number[] = [];
    if (logoImg) blocks.push(logoH);
    let nameSize = 0;
    let nameLines: string[] = [];
    if (hasName) {
      const fit = fitHeadline(ctx, opts.name.trim(), maxW, 1, nameMax, nameMin);
      nameSize = fit.size;
      nameLines = fit.lines;
      blocks.push(nameSize);
    }
    if (hasTag) blocks.push(tagSize);
    const gap = Math.round(H * 0.06);
    const totalH = blocks.reduce((s, b) => s + b, 0) + gap * Math.max(0, blocks.length - 1);
    let cursorY = safeMidY - totalH / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    if (logoImg) {
      const lw = (logoImg.width / logoImg.height) * logoH;
      ctx.drawImage(logoImg, W / 2 - lw / 2, cursorY, lw, logoH);
      cursorY += logoH + gap;
    }
    if (hasName) {
      ctx.font = `800 ${nameSize}px "Inter", system-ui, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.fillText(nameLines[0] ?? opts.name.trim(), W / 2, cursorY);
      cursorY += nameSize + gap;
    }
    if (hasTag) {
      ctx.font = `500 ${tagSize}px "Inter", system-ui, sans-serif`;
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

    if (logoImg) {
      const lw = (logoImg.width / logoImg.height) * logoH;
      ctx.drawImage(logoImg, x, safeMidY - logoH / 2, lw, logoH);
      x += lw + Math.round(H * 0.12);
    }

    let nameSize = 0;
    let nameLines: string[] = [];
    if (hasName) {
      const fit = fitHeadline(ctx, opts.name.trim(), maxW - (x - startX), 1, nameMax, nameMin);
      nameSize = fit.size;
      nameLines = fit.lines;
    }
    const gap = Math.round(H * 0.05);
    const blockH = (hasName ? nameSize : 0) + (hasName && hasTag ? gap : 0) + (hasTag ? tagSize : 0);
    let y = safeMidY - blockH / 2;
    if (hasName) {
      ctx.font = `800 ${nameSize}px "Inter", system-ui, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.fillText(nameLines[0] ?? opts.name.trim(), x, y);
      y += nameSize + gap;
    }
    if (hasTag) {
      ctx.font = `500 ${tagSize}px "Inter", system-ui, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.globalAlpha = 0.85;
      ctx.fillText(opts.tagline.trim(), x, y);
      ctx.globalAlpha = 1;
    }
  }

  return canvas;
}