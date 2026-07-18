# Icon Kit — content-aware texture/accent refactor + new shape-layer catalog

Status: **BUILT 2026-07-18** (typechecks clean via `tsc -b`; verified live on the
dev server at :8118). See the "2026-07-18 completion notes" section at the bottom
for exactly what shipped, including a mid-session course-correction on the accent
rule and two adds Ruthnie asked for (Select highlight fix + more textures).

Originally: planned, not built (written 2026-07-18).

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
- `src/components/icon-kit/social-controls.tsx` — `TexturePicker` (reads the
  `TEXTURES` list; no per-option edits needed — it maps the array).

---

## 2026-07-18 completion notes

Built in one session. Everything below is shipped and typechecks (`tsc -b` clean).

### The content-awareness contract (as planned)
- **`paintTexture(ctx, kind, accent, W, H, reserved: Rect[], contentStartX)`** —
  new `Rect` type + `reserved` param (`canvas.ts`). Hard-edged textures anchor
  into the free zones around the reserved union; ambient ones ignore it.
- **`freeZones(reserved, W, H)`** picks the largest free band (top/bottom) and
  free column (left/right) so hard-edged accents land where the content isn't.
- **`paintCanvasLayers(..., deferTexture)`** — new flag. `renderBanner` defers the
  texture pass, computes the content footprint (content column + bottom-left
  avatar + contact bar + photo panel, all as coarse `Rect`s), then paints texture
  UNDER the photo/contact/text but AFTER geometry is known. Z-order unchanged.
- **`respectsContent` flag** on every `TextureDef` (`social-design.ts`) — hard-edged
  = true, ambient = false. `textureRespectsContent()` helper exported.
- Preview + export still run through the SAME `renderBanner`, so the reserved-zone
  math is identical in both (one renderer). Verified.

### Course-correction: the accent rule (IMPORTANT — differs from the original plan)
The plan said hard-edged textures should "shift out of the reserved zone." For the
**accent rule specifically that was wrong**, and Ruthnie caught it live: moving the
rule to the free (right) side killed the editorial top-left-kicker effect she
actually wanted. The rule is now a **FIXED top-left kicker; the CONTENT clears IT**
(the reverse). When `texture === "accent-rule"`, `renderBanner` drops `bandTop`
below the rule (`accentRuleRect()` gives the exact band) so the logo/text nudge
down instead of the rule fleeing. `accentRuleRect(W,H,startX)` is exported and
shared so the reserved band and the drawn rule always agree.

- **`accent-rule`** = classic top-left kicker, content clears it. RESTORED as its
  own texture (survives the old saved id unchanged).
- **`edge-rule`** = the content-aware free-side rule (kept — Ruthnie may use the
  right-side version for other clients).

### Inset-or-bleed discipline (fixes the Facebook "stuck to the ceiling" bug)
Every hard-edged texture now either sits at a clean `edgeInset(short)` margin from
the **canvas** edge OR bleeds fully to it — never hovers a few px short (which read
as a mistake). This was the Facebook banner bug Ruthnie flagged: the old free-band
math jammed accents against the border when the free band was thin. Fixed on
edge-rule, corner-bracket, ticker, dot-field (and applied to all new ones).

### New catalog — net GREW past the old 11 (now 16 textures + None = 17 options)
Old set (`corner-blob, diagonal, accent-rule, dot-grid, arc-lines, stripes,
confetti, wave-band, grid-lines, halftone`) was replaced/renamed. `diagonal,
arc-lines, stripes, confetti, grid-lines, halftone` were RETIRED; `corner-blob→
corner-glow`, `dot-grid→dot-field` renamed; `accent-rule, wave-band` kept.

Current list:
- Ambient (overlap OK): `corner-glow, mesh, spotlight, wave-band, soft-rays,
  noise-dots (label "Fine grain")`.
- Hard-edged (respect content): `accent-rule, edge-rule, underline-sweep,
  corner-bracket, steps, ticker, dot-field, side-bar, notch, frame`.

### Saved-draft migration (so nothing breaks on reopen)
`migrateTextureKind(id)` + `LEGACY_TEXTURE_MAP` in `social-design.ts` map any
retired/renamed id to the nearest surviving texture. Applied at the reducer
`patch`, in `buildDesign` (render-time net), and on the `TexturePicker` value so a
hydrated old draft never lands on a blank Select. `SocialPanel` default texture
changed `corner-blob → corner-glow`.

### Bonus fix Ruthnie asked for: the too-dark Select dropdown highlight
Known AntD gotcha — the Select's selected/hover row bg is derived from
`colorPrimary` (our dark green), so it rendered as a heavy muddy grey-green.
Fixed with component-scoped tokens in `App.tsx`:
`Select.optionSelectedBg = #e8f2ec`, `optionSelectedColor = #1c332c`,
`controlItemBgHover = #f0f6f3` (pale brand tints). Scoped to Select only.

### Post-review trim + per-tier text colors (same session, later)
After eyeballing the batch, Ruthnie cut the weak textures — "I'd rather have five
really decent ones than seventeen useless ones." REMOVED: `underline-sweep, steps,
ticker, dot-field, side-bar, notch` (all mapped in `LEGACY_TEXTURE_MAP` so saved
drafts migrate). **Final set = 10 + None:** corner-glow, mesh, spotlight,
wave-band, soft-rays, noise-dots (Fine grain), accent-rule, edge-rule,
corner-bracket, frame. The deeper "why are they lame / what are textures FOR"
conversation produced a separate planning doc — **`TEXTURE_THEORY_PLAN.md`** —
which is the real next-session deliverable (texture = job, industry logic, craft
techniques). Do not freestyle more shapes; build from that doc.

**Per-tier text colors (NEW, shipped this session):** eyebrow / brand name /
tagline can now be colored independently so they read as a hierarchy.
- `TextColors { eyebrow?, name?, tagline? }` on `DesignLayers`; `resolveTextTiers`
  in canvas.ts resolves them. Name = base `textColor`; eyebrow + tagline default
  to MUTED derivations (`autoTierColor` / `muteColor` / `TIER_MUTE` in
  social-design.ts — shared so the panel swatch preview matches the render).
- **Deliberately NOT tied to the accent color** — Ruthnie caught that borrowing the
  accent would wash the eyebrow out whenever an accent-tinted ambient texture
  (glow/mesh) is active. Tiers derive from the text color instead.
- Threaded through BOTH renderers (all banner + OG branches). The old per-branch
  `globalAlpha 0.85/0.9` tagline softening was removed — the muted tier color does
  that job now, so an explicit override renders true.
- Panel: new `eyebrowColor` / `taglineColor` state (`"" = auto`), a reusable
  `TierColorControl` (social-controls.tsx) with an Auto/reset affordance, wired
  into section 1 (Brand name & type). `buildDesign` only passes overrides that are
  set. Persists via the existing localStorage reducer; reopen falls back to auto.

### Left for a later pass (explicitly out of scope this session)
- `renderSocial` (the 1200×630 OG card) still uses the NON-deferred texture path —
  content-blind, but with the new texture set. Ambient textures dominate there and
  the centered content sits low, so hard-edged ones land acceptably at the edge
  inset. Wire the reserved-zone into `renderSocial` when the OG card needs it.
- Font/typography pass — still a separate future session (see Scope note above).
- Exact spacing/inset calibration is my best guess pending Ruthnie's pixel review;
  one constant (`edgeInset`) controls the margin for all hard-edged textures.
