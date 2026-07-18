# Icon Kit — texture theory: what textures are FOR (and which ones earn a slot)

Status: **planning doc, written 2026-07-18.** This is the thinking Ruthnie asked
for after the first texture batch shipped and read as filler. The complaint was
correct and precise: *"it's not about whipping something up that I approve or
don't — it's about what is the VALUE of these textures. Is there any logic to it
in the social-design world?"* This doc answers that, then lets the logic decide
which textures to build. Build session comes next; do NOT freestyle shapes.

## The core problem with the current set

The current 10 textures (corner-glow, mesh, spotlight, wave-band, soft-rays,
noise-dots, accent-rule, edge-rule, corner-bracket, frame) are a **pile of
options with no theory**. There's no answer to "when would I use THIS one vs. that
one," so every one feels arbitrary — which is exactly why they read as cheap. A
texture that can't state its job is decoration, and decoration with no job is
filler. The fix is not "more shapes." It's: **give every texture a job, kill the
ones with no job, and surface the job to the user.**

Not a tech limit — canvas can do gradients, blur (`filter`), shadow, blend modes
(`globalCompositeOperation`), grain, clipping, per-pixel work. The first batch was
flat `fillRect` clip art because it optimized for "content-aware + safe" and forgot
"good." This doc is about the missing half.

## Textures do JOBS. There are five.

In real social/brand design, a background treatment is never neutral. It's doing
one of these:

1. **Legibility (scrim / wash).** Make text survive on a busy or photographic
   background. A gradient scrim behind the headline, a corner darkening, a duotone
   grain that unifies a photo. This is the ONLY texture job that's about function
   first. It pairs with the photo-panel + OG-photo layouts. *Value: the banner is
   readable at all.*

2. **Depth / focus.** Push the background back and pull the eye to the headline —
   vignettes, soft radial glows, gradient meshes. Low-contrast, diffuse. *Value:
   hierarchy; the name reads as the hero.* (corner-glow, mesh, spotlight already
   do this — they're the survivors for a reason.)

3. **Brand register (genre signal).** The texture tells you what KIND of business
   this is before you read a word. This is where industry logic lives (below).
   *Value: the banner "feels like" a law firm / a gym / a wellness brand.*

4. **Structure / editorial.** A rule, a keyline, a bracket — marks that organize
   the composition and signal "a designer touched this." Hard-edged, deliberate.
   *Value: intentionality; it doesn't look auto-generated.* (accent-rule,
   edge-rule, corner-bracket, frame.)

5. **Energy / motion.** Rays, sweeps, angled fields — imply momentum. *Value:
   matches high-energy genres (fitness, events, launches) and fights the static
   feel.* (soft-rays.)

**Rule for the catalog: every texture must name its primary job.** If it can't, it
doesn't ship. Two textures doing the SAME job (e.g. corner-glow and mesh both =
depth) is fine only if they read distinctly; if they don't, cut one.

## Industry logic — genre DOES lean

This is the part that makes the picker feel smart instead of random. Real design
conventions, not invented:

| Genre / industry            | Leans toward                          | Job(s)        | Avoid |
|-----------------------------|---------------------------------------|---------------|-------|
| Wellness / health / therapy | soft gradient mesh, radial glow       | depth         | hard geometry, grain |
| Legal / finance / consulting| keyline frame, thin accent rule       | structure     | playful, motion |
| Tech / SaaS / startup       | gradient mesh, subtle grid, angled field | depth+structure | ornate, warm grain |
| Editorial / creative / media| print grain, halftone, bold rule kicker | brand register | flat digital gradients |
| Fitness / events / launches | diagonal energy field, rays, sweep    | motion        | calm washes |
| Luxury / beauty             | fine grain, thin frame, restrained glow | register+structure | busy, high-chroma |
| Photography-forward brands  | scrim / duotone wash                  | legibility    | anything opaque over the photo |

**How to surface it (build-session decision):** either (a) tag each texture with
the genres it serves and show a "suggested for [genre]" hint, or (b) a "brand
vibe" picker (like Palette Studio's vibe tags — already in `shared-fonts.ts`) that
filters/sorts textures. Option (b) is stronger and consistent with the font
picker's existing pattern. Lean (b).

## What that means for the actual catalog

Judge each CURRENT texture against a named job. Keep, upgrade, or cut:

- **corner-glow** — KEEP. Job: depth. Clean.
- **mesh** — KEEP but UPGRADE. Job: depth + tech/wellness register. Ruthnie:
  "gives the same as a gradient background." Fix: make it clearly a *mesh* (2–3
  offset color stops, soft-light blend over the bg) so it reads as texture, not a
  second gradient. Right now it's too close to the gradient bg option.
- **spotlight** — KEEP. Job: depth/focus.
- **wave-band** — KEEP (low priority). Job: depth, SaaS register. "Lame but sure."
- **soft-rays** — KEEP. Job: energy/motion. Only genre-right one for motion; it's
  the fitness/events pick.
- **noise-dots (Fine grain)** — KEEP + LEAN IN. Job: brand register (editorial /
  luxury / premium). This is the one Ruthnie actually liked — because grain is a
  REAL design technique, not clip art. Grain is the single highest-value addition
  we can make; consider a couple grain flavors (fine / coarse / paper) done right.
- **accent-rule / edge-rule** — KEEP both. Job: structure (editorial kicker).
- **corner-bracket** — KEEP. Job: structure. Ruthnie's current lean for the client.
- **frame** — KEEP but FIX. Job: structure (luxury/legal register). Known bug:
  "doesn't work on anything but the social card." The banner path draws a keyline
  with gaps around the reserved zone, but on wide short banners the inset math and
  the reserved-zone knockouts read wrong. Needs a banner-specific frame geometry.

## The real upgrades worth building (job-first, not shape-first)

These earn a slot because each does a job the current set does poorly or not at all:

1. **Legibility scrim** — a gradient darkening behind the text column (job #1).
   NOTHING in the set does the legibility job today; the photo layouts need it.
   Highest functional value.
2. **Grain family done right** — fine / paper grain via seeded noise at low alpha,
   possibly `soft-light` blend (job #3, editorial/luxury). The one texture type
   Ruthnie endorsed; deepen it.
3. **Real gradient mesh** (upgrade of `mesh`) — multi-stop, blended, so it stops
   reading as "just a gradient" (job #2, tech/wellness).
4. **Blurred color-field** — a large soft-focus accent blob (canvas `filter:
   blur`) bleeding behind the logo (job #2). Ruthnie: "sure, we could see what that
   looks like" — but ONLY if it's distinct from corner-glow/spotlight, not a
   third radial. Make it a large off-axis *shape* that's blurred, not another
   centered radial, or cut it.

Everything above is justified by a JOB. Anything that can't be is out.

## Craft techniques the first batch skipped (why they looked cheap)

Use these; they're the difference between clip art and brand kit, all canvas-native:
- **Blend modes** (`globalCompositeOperation = "soft-light" | "multiply" |
  "overlay"`) so a texture interacts with the bg instead of sitting on top.
- **Layered translucency** — 2–3 low-alpha passes, not one flat fill.
- **Grain / noise** — seeded (family rule: no Math.random), low alpha.
- **Blur** (`ctx.filter = "blur(...)"`) for soft-focus fields.
- **Tonal variation** — gradient within the shape (accent → transparent), never
  one flat hue at one alpha.

## Guardrails to carry over from the content-aware work

- Keep the `respectsContent` contract + reserved-zone math (already built — see
  TEXTURE_CONTENT_AWARE_PLAN.md). New textures declare their flag.
- No `Math.random()` — use the seeded `seeded()` PRNG in canvas.ts.
- Preview + export share one renderer; keep it that way.
- `wire renderSocial` into the reserved-zone path if any new hard-edged texture
  needs it on the OG card (currently OG uses the non-deferred path).
- Restrained brands must still look clean on `none` or a soft wash.

## Suggested build-session shape

1. Decide the surfacing model (recommend: a brand-vibe tag on each texture, reuse
   the vibe-picker pattern). 
2. Build the 4 job-first upgrades above (scrim, grain family, real mesh, blurred
   field) with the craft techniques — NOT more flat shapes.
3. Re-judge every texture against its job; cut any that still can't state one.
4. Tag textures by genre; add the "suggested for your vibe" hint to the picker.
5. Verify each on the Facebook banner (the tight one) AND the OG card.
