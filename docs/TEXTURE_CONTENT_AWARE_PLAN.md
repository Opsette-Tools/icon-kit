# Icon Kit — content-aware texture/accent refactor + new shape-layer catalog

Status: **planned, not built** (written 2026-07-18). This is the plan for the next
session's "new textures & accents" work.

## Why

Textures (the "shape layer" / accent) are painted in `paintCanvasLayers`
(`src/lib/icon-kit/canvas.ts`) in the **background layer — before the content lays
out**. So no texture knows where the logo or text actually lands. Hard-edged
textures collide with the brand.

Confirmed collision (Twitter/X banner, **Highlight** layout, `accent-rule`
texture): the gold rule is drawn at a fixed top-left point
(`inset = W*0.055`, `topY = H*0.12`) and slices straight across the logo, which
also sits top-left in the highlight content block. It happens regardless of which
logo is used — the rule is blind to it. Soft washes (`corner-blob`, `dot-grid`,
etc.) get away with it only because they're diffuse + low-opacity; they're just as
content-blind, structurally.

Do NOT patch `accent-rule` in isolation — the refactor below deletes/rewrites it.

## The fix — a content-awareness contract for the texture pass

1. **Compute the content footprint first.** In `renderBanner` (and optionally
   `renderSocial`), before painting the texture, compute the bounding boxes the
   content will occupy: the **logo box** (x/y/w/h once its drawn size is known)
   and the **text block bounds**. Today the logo draw size is computed *inside*
   each layout branch — the refactor needs to hoist that measurement so it's known
   before `paintTexture` runs (or split paint order so texture is drawn after
   content-geometry is resolved but under the text fill).

2. **Pass a `reserved` zone into `paintTexture`.** New signature roughly:
   `paintTexture(ctx, kind, accent, W, H, { reserved?: Rect[] })` where `reserved`
   is the union of the logo box + text block (with a small margin).

3. **Each texture respects the zone per its nature:**
   - **Hard-edged** (accent-rule, diagonal block, stripes, bars): must *avoid* the
     reserved zone — shift out of it, clip against it, or anchor to a free corner.
   - **Ambient/diffuse** (corner-blob radial glow, arc-lines, soft wave-band): may
     overlap; they read as depth, not as a shape hitting the logo.
   - Encode this as a per-texture flag (e.g. `respectsContent: true|false`) so new
     textures opt in explicitly.

4. **Then design the NEW catalog on top of the contract.** Current set reads as
   boring (corner-blob, diagonal, accent-rule, dot-grid, arc-lines, stripes,
   confetti, wave-band). Replace/extend with a fresh, more intentional set — every
   new one built content-aware from day one.

## Guardrails / house rules to honor

- No `Math.random()` — use the existing seeded `mulberry32` for any scatter
  (family rule; preview and export must match).
- Preview and export render through the SAME `renderBanner`/`renderSocial`, so the
  reserved-zone math must be identical in both paths (it already is — one renderer).
- Keep the accent color driving the texture tint (`design.accentColor`).
- Restrained brands (e.g. medical/functional-health) should still look clean with
  `none` or a soft wash — don't make the default set busy.

## Scope note

This pairs naturally with a font/typography pass (Ruthnie flagged fonts as a
separate future session too). Keep them separate unless they clearly overlap.

## Files

- `src/lib/icon-kit/canvas.ts` — `paintTexture`, `paintCanvasLayers`,
  `renderBanner`, `renderSocial`.
- `src/lib/icon-kit/social-design.ts` — `TextureKind` type + any texture metadata.
- `src/components/icon-kit/social-controls.tsx` — `TexturePicker` (add/rename the
  new options here).
