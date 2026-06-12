# Icon Kit — Plan

A single-page, fully client-side tool (no backend, no auth) with two generators behind an AntD `Segmented` switch. Everything runs in the browser via `<canvas>`.

Note on naming: spec calls the project "Icon Kit" internally but specifies the visible `<h1>` and page title use "Icon Kit". I'll use Icon Kit as the user-facing name everywhere (header, title, OG meta) and keep "Icon Kit" only as an internal code comment.

## 1. Setup

- Install: `antd@5`, `@ant-design/icons`, `jszip`, and a tiny ICO encoder (`png-to-ico` is Node-only; will use `**@realxda/png2ico**` or hand-roll a small ICO writer that wraps three PNG blobs — ICO format is trivial: header + directory entries + PNG payloads). Hand-rolled encoder avoids dependency risk.
- Remove `@tanstack/react-query` from any imports if present (template ships with it; we just won't use it for new code — no need to uninstall).
- Add Inter via `<link>` in `index.html` (Google Fonts) so AntD + canvas both render with it.
- `vite.config.ts`: set `base: command === "build" ? "/favicon-forge/" : "/"`.
- `index.html`: set `<title>Favicon Forge</title>`, `<meta name="description" content="...">`, theme-color `#2f4f46`.
- Wrap app in AntD `ConfigProvider` with theme tokens: `colorPrimary: "#2f4f46"`, `fontFamily: "Inter, ..."`, `colorBgLayout: "#fafafa"`.

## 2. Routes / Shell

- Keep TanStack Start shell; single route `src/routes/index.tsx` replaces the placeholder.
- Root `__root.tsx`: update head meta (title, description, theme-color, OG).
- Sticky top header: thin AntD `Layout.Header` (white bg, subtle border-bottom) containing just `<h1>Favicon Forge</h1>` (styled small, not hero). Below: `Segmented` with "Favicon" / "Social Image". Content area is centered, max-width ~720px, mobile-first padding.

## 3. Favicon Generator (`src/components/favicon/`)

State (single `useReducer`):

- `source`: `{ type: "image", dataUrl } | { type: "initials", text, fg, bg } | { type: "emoji", char }`
- `background`: `"transparent" | "solid" | "tile"` + `bgColor`
- `padding`: 0–30 (%)
- `radius`: 0–50 (% of size; 50 = circle)

UI (AntD):

- `Tabs` for source type: Upload (`Upload.Dragger`), Initials (`Input` maxLength 3 + two `ColorPicker`s), Emoji (`Input` with native emoji or a small picker grid of ~30 common emojis to avoid heavy deps).
- `Radio.Group` for background mode, `ColorPicker` for bg color, two `Slider`s for padding + radius.
- Live preview: render 128×128 canvas with current settings. Show 16 / 32 / 180 thumbnails next to it.
- Primary `Button` "Download ZIP".

Rendering pipeline (`renderIcon(size, opts) -> Blob`):

1. Create offscreen canvas at `size`.
2. If background tile: fill rounded rect (`radius%` of size) with `bgColor`; else if solid: fill rect; else leave transparent.
3. Compute safe area = `size * (1 - padding/100)`, centered.
4. Draw source:
  - image: `drawImage` fit-contain into safe area (SVG handled via `<img>` element load).
  - initials: set Inter bold, autosize font to fit safe area width, `fillText` centered with `fg`.
  - emoji: same as initials but with the emoji glyph.
5. For maskable variant: force extra 10% inner padding regardless of user padding (per W3C maskable spec).

ZIP contents (via `jszip`):

- `favicon-16x16.png`, `favicon-32x32.png` (render at those sizes)
- `apple-touch-icon.png` (180, force solid bg if user chose transparent — iOS requirement; show a small notice)
- `icon-192.png`, `icon-512.png`
- `icon-512-maskable.png` (with safe-area)
- `favicon.ico` — multi-image ICO containing 16/32/48 PNG payloads (hand-rolled encoder, ~60 lines)
- `site.webmanifest` — pre-filled with icons array, `theme_color`, `background_color` (asks user for app name in an `Input`, defaults to "My App")

Snippet panel: AntD `Typography.Paragraph copyable` with the `<link>` / `<meta>` tags.

## 4. Social Image Generator (`src/components/social/`)

State (`useReducer`):

- `headline`, `subhead`
- `logo`: optional `{ dataUrl }`
- `background`: `{ type: "solid", color } | { type: "gradient", from, to, angle } | { type: "image", dataUrl, overlay: 0..0.8 }`
- `layout`: `"centered" | "logo-tl-text-left" | "split"` (3 presets — keeping it tight)

UI: form on top, live preview below (scaled, maintains 1200×630 ratio with `aspect-ratio` CSS), download button.

Rendering (`renderSocial() -> Blob`):

1. 1200×630 canvas.
2. Background: solid fill, or `createLinearGradient`, or `drawImage` cover + dark overlay rect.
3. Layout-specific text + logo placement; Inter font, auto-shrink headline if too long (binary search font-size until it fits two lines).
4. Export PNG via `canvas.toBlob`.

Output: download button + `Typography.Paragraph copyable` with OG/Twitter meta snippet pre-filled with headline/subhead (URL/image path left as `/og-image.png` placeholder with note).

## 5. Shared utilities (`src/lib/`)

- `canvas.ts`: `renderIcon`, `renderSocial`, helpers for rounded-rect, fit-text, image loading.
- `ico.ts`: ICO encoder that wraps PNG blobs (PNG-in-ICO, supported by all modern browsers/OSes).
- `download.ts`: `downloadBlob(blob, name)` and `zipAndDownload(files)`.

## 6. File list

- `index.html` — title, meta, theme-color, Inter font link
- `vite.config.ts` — set `base`
- `src/routes/__root.tsx` — head meta, AntD ConfigProvider
- `src/routes/index.tsx` — shell with header + Segmented + two panels
- `src/components/favicon/FaviconPanel.tsx` (+ source sub-components)
- `src/components/social/SocialPanel.tsx`
- `src/lib/canvas.ts`, `src/lib/ico.ts`, `src/lib/download.ts`

## 7. What I will NOT do

- No backend, no server functions, no Lovable Cloud.
- No shadcn/Radix/lucide imports in new code (existing shadcn UI files in `src/components/ui/` stay untouched but unused).
- No `@tanstack/react-query` for new state.
- No emoji-picker-react or other heavy deps — small built-in grid.

## Open question

The spec calls the product "Icon Kit" in one place and "Icon Kit" everywhere else (h1, base path, title). I'll use Icon Kit as the visible name. Tell me if you'd rather see "Icon Kit" in the header instead.   
  
Use 'Icon Kit'!!!