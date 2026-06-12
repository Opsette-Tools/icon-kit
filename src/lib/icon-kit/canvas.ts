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

export async function renderIcon(size: number, opts: IconOpts): Promise<HTMLCanvasElement> {
  await ensureInter();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
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