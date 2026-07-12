// Preview-only safe-zone guide. Renders a ghosted circle where each platform's
// bottom-left profile avatar lands (plus its ring), so the designer can SEE the
// clearance while working. This is an absolutely-positioned DOM layer over the
// preview canvas — it is NEVER part of the exported/downloaded image, because
// the export re-renders from the canvas engine which knows nothing about it.

import type { BannerPlatform } from "../../lib/icon-kit/canvas";

// Where the round avatar sits on each platform, as fractions of the banner box.
// cx/cy = center of the avatar circle; d = its diameter (all relative to width
// for x, height for y where noted). These mirror the real platform crops.
const AVATAR_GEOMETRY: Record<
  BannerPlatform,
  { cxPct: number; bottomPct: number; diaPctW: number }
> = {
  // LinkedIn: avatar overlaps lower-left, ~ x≈9% from left, hanging below.
  linkedin: { cxPct: 0.09, bottomPct: 0.0, diaPctW: 0.14 },
  // Facebook page: profile pic bottom-left, larger relative to the short cover.
  facebook: { cxPct: 0.11, bottomPct: 0.06, diaPctW: 0.2 },
  // Twitter/X: avatar bottom-left, overlapping the header's lower edge.
  twitter: { cxPct: 0.08, bottomPct: 0.0, diaPctW: 0.13 },
};

export function SafeZoneOverlay({ platform }: { platform: BannerPlatform }) {
  const g = AVATAR_GEOMETRY[platform];
  // Size as % of the container width so it scales with the responsive preview.
  const diaPct = g.diaPctW * 100;
  const leftPct = g.cxPct * 100;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${leftPct}%`,
          bottom: `${g.bottomPct * 100}%`,
          width: `${diaPct}%`,
          aspectRatio: "1 / 1",
          transform: "translate(-50%, 50%)",
          borderRadius: "50%",
          border: "2px dashed rgba(255,255,255,0.9)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.35)",
          background: "rgba(0,0,0,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "clamp(7px, 1.4vw, 11px)",
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.7)",
            fontWeight: 600,
            letterSpacing: 0.3,
            userSelect: "none",
          }}
        >
          avatar
        </span>
      </div>
    </div>
  );
}
