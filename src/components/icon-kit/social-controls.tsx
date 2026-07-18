// Reusable control components for the Social & Banner builder. Kept out of
// SocialPanel so the panel stays a composition of small pieces, and so a
// control (font picker, texture chooser, contrast shield) can be reused by the
// favicon panel or a future surface without copy-paste.

import { useEffect, useRef } from "react";
import { Alert, Button, ColorPicker, Input, Segmented, Select, Slider, Space, Switch, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined, WarningFilled, CheckCircleFilled } from "@ant-design/icons";

import {
  FONT_PAIRS,
  TEXTURES,
  WATERMARK_EDGES,
  HIGHLIGHT_STYLES,
  type TextureKind,
  type WatermarkEdge,
  type HighlightStyle,
  contrastRatio,
  CONTRAST_MIN,
  autoTierColor,
} from "../../lib/icon-kit/social-design";

const { Text } = Typography;

export function FontPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={{ width: "100%" }}
      options={FONT_PAIRS.map((f) => ({
        value: f.id,
        label: (
          <span style={{ fontFamily: f.headingFamily }}>
            {f.label}
          </span>
        ),
      }))}
    />
  );
}

// A single text-tier color control (eyebrow / tagline). "Auto" means derive a
// muted tone from the base text color; the swatch previews that derived tone so
// the user sees what auto looks like. Picking a color sets an explicit override;
// the Auto link clears it. Keeps the three-tier color UI DRY — one component,
// used per tier, instead of pasting a ColorPicker + reset per row.
export function TierColorControl({
  label,
  tier,
  value,
  baseTextColor,
  onChange,
}: {
  label: string;
  tier: "eyebrow" | "tagline";
  value: string; // "" = auto
  baseTextColor: string;
  onChange: (hex: string) => void;
}) {
  const isAuto = !value;
  const effective = value || autoTierColor(tier, baseTextColor);
  return (
    <Space size={8}>
      <span style={{ minWidth: 62, display: "inline-block" }}>{label}</span>
      <ColorPicker value={effective} onChange={(c) => onChange(c.toHexString())} />
      {isAuto ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Auto (muted)
        </Text>
      ) : (
        <Button size="small" type="link" style={{ padding: 0 }} onClick={() => onChange("")}>
          Reset to auto
        </Button>
      )}
    </Space>
  );
}

export function TexturePicker({
  value,
  onChange,
}: {
  value: TextureKind;
  onChange: (id: TextureKind) => void;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={{ width: "100%" }}
      options={TEXTURES.map((t) => ({ value: t.id, label: t.label }))}
    />
  );
}

export function WatermarkControls({
  enabled,
  edge,
  opacity,
  scale,
  hasLogo,
  onToggle,
  onEdge,
  onOpacity,
  onScale,
}: {
  enabled: boolean;
  edge: WatermarkEdge;
  opacity: number;
  scale: number;
  hasLogo: boolean;
  onToggle: (on: boolean) => void;
  onEdge: (e: WatermarkEdge) => void;
  onOpacity: (v: number) => void;
  onScale: (v: number) => void;
}) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={10}>
      <Space>
        <Switch checked={enabled} onChange={onToggle} disabled={!hasLogo} />
        <Text>Large faded logo watermark</Text>
      </Space>
      {!hasLogo && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Upload a logo above to use it as a background watermark.
        </Text>
      )}
      {enabled && hasLogo && (
        <>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bleeds off
            </Text>
            <Segmented
              size="small"
              block
              value={edge}
              onChange={(v) => onEdge(v as WatermarkEdge)}
              options={WATERMARK_EDGES.map((w) => ({ label: w.label, value: w.id }))}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Opacity — {Math.round(opacity * 100)}%
            </Text>
            <Slider min={3} max={30} value={Math.round(opacity * 100)} onChange={(v) => onOpacity((v as number) / 100)} />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Size — {Math.round(scale * 100)}%
            </Text>
            <Slider min={80} max={220} value={Math.round(scale * 100)} onChange={(v) => onScale((v as number) / 100)} />
          </div>
        </>
      )}
    </Space>
  );
}

// The readability guardrail. Computes contrast of text vs. the dominant bg
// color and warns below AA-large (3:1), with a one-tap auto-fix that flips the
// text to whichever of black/white reads best. Same shield QR Creator got.
export function ContrastShield({
  textColor,
  bgColor,
  onFix,
}: {
  textColor: string;
  bgColor: string;
  onFix: (color: string) => void;
}) {
  const ratio = contrastRatio(textColor, bgColor);
  const ok = ratio >= CONTRAST_MIN;
  if (ok) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleFilled />}
        message={
          <Text style={{ fontSize: 13 }}>
            Text is readable — contrast {ratio.toFixed(1)}:1
          </Text>
        }
        style={{ padding: "6px 12px" }}
      />
    );
  }
  const best = contrastRatio("#ffffff", bgColor) >= contrastRatio("#000000", bgColor) ? "#ffffff" : "#000000";
  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningFilled />}
      message={
        <Space size={8} wrap>
          <Text style={{ fontSize: 13 }}>
            Low contrast ({ratio.toFixed(1)}:1) — text may be hard to read.
          </Text>
          <Button size="small" onClick={() => onFix(best)}>
            Use {best === "#ffffff" ? "white" : "black"} text
          </Button>
        </Space>
      }
      style={{ padding: "6px 12px" }}
    />
  );
}

export function DuotoneControls({
  enabled,
  shadow,
  highlight,
  onToggle,
  onShadow,
  onHighlight,
}: {
  enabled: boolean;
  shadow: string;
  highlight: string;
  onToggle: (on: boolean) => void;
  onShadow: (c: string) => void;
  onHighlight: (c: string) => void;
}) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={10}>
      <Space>
        <Switch checked={enabled} onChange={onToggle} />
        <Text>Brand-tint the photo (duotone)</Text>
      </Space>
      {enabled && (
        <Space wrap>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Shadows
            </Text>
            <ColorPicker value={shadow} onChange={(c) => onShadow(c.toHexString())} />
          </Space>
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Highlights
            </Text>
            <ColorPicker value={highlight} onChange={(c) => onHighlight(c.toHexString())} />
          </Space>
        </Space>
      )}
    </Space>
  );
}

export function ImageUploadButton({ label, upload }: { label: string; upload: UploadProps }) {
  return (
    <Upload {...upload}>
      <Button icon={<InboxOutlined />}>{label}</Button>
    </Upload>
  );
}

// A draggable focal-point pad: shows a thumbnail of the actual photo with a
// movable dot. Drag the dot onto the part of the photo you want kept in frame
// (a face, say) and that point stays centered as the photo zooms/crops. Much
// finer than a 3×3 grid — this is the "game controller" positioning.
function PhotoFocusPad({
  photo,
  focusX,
  focusY,
  onChange,
}: {
  photo: string;
  focusX: number;
  focusY: number;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    onChange(Number(x.toFixed(3)), Number(y.toFixed(3)));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      setFromEvent(e.clientX, e.clientY);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true;
        setFromEvent(e.clientX, e.clientY);
      }}
      style={{
        position: "relative",
        width: 132,
        aspectRatio: "1 / 1",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #d9d9d9",
        backgroundImage: `url(${photo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        cursor: "crosshair",
        touchAction: "none",
        userSelect: "none",
        flex: "0 0 auto",
      }}
    >
      {/* subtle darken so the dot reads on any photo */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.12)" }} />
      <div
        style={{
          position: "absolute",
          left: `${focusX * 100}%`,
          top: `${focusY * 100}%`,
          width: 22,
          height: 22,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          border: "3px solid #fff",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.4)",
          background: "rgba(47,79,70,0.35)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Photo-panel controls (banner "Photo" layout) ─────────────────────────────
export function PhotoPanelControls({
  photo,
  side,
  divider,
  zoom,
  focusX,
  focusY,
  upload,
  onRemove,
  onSide,
  onDivider,
  onZoom,
  onFocus,
}: {
  photo: string | null;
  side: "left" | "right";
  divider: "straight" | "diagonal" | "curve";
  zoom: number;
  focusX: number;
  focusY: number;
  upload: UploadProps;
  onRemove: () => void;
  onSide: (s: "left" | "right") => void;
  onDivider: (d: "straight" | "diagonal" | "curve") => void;
  onZoom: (v: number) => void;
  onFocus: (x: number, y: number) => void;
}) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={10}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        A person or product photo carved into one side — set a banner's layout to
        <b> Photo</b> to use it.
      </Text>
      <Space>
        <Upload {...upload}>
          <Button icon={<InboxOutlined />}>{photo ? "Replace photo" : "Upload panel photo"}</Button>
        </Upload>
        {photo && (
          <Button type="link" onClick={onRemove}>
            Remove
          </Button>
        )}
      </Space>
      {photo && (
        <>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Photo side
            </Text>
            <Segmented
              size="small"
              block
              value={side}
              onChange={(v) => onSide(v as "left" | "right")}
              options={[
                { label: "Left", value: "left" },
                { label: "Right", value: "right" },
              ]}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Divider shape
            </Text>
            <Segmented
              size="small"
              block
              value={divider}
              onChange={(v) => onDivider(v as "straight" | "diagonal" | "curve")}
              options={[
                { label: "Straight", value: "straight" },
                { label: "Diagonal", value: "diagonal" },
                { label: "Curve", value: "curve" },
              ]}
              style={{ marginTop: 4 }}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Zoom — {Math.round(zoom * 100)}%
            </Text>
            <Slider min={100} max={250} value={Math.round(zoom * 100)} onChange={(v) => onZoom((v as number) / 100)} />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                Position
              </Text>
              <PhotoFocusPad photo={photo} focusX={focusX} focusY={focusY} onChange={onFocus} />
            </div>
            <Text type="secondary" style={{ fontSize: 11, flex: 1, marginTop: 18 }}>
              Drag the dot onto what you want kept in frame — put it on your face
              and it stays centered as you zoom. Then set zoom to taste.
            </Text>
          </div>
        </>
      )}
    </Space>
  );
}

// ── Word-click highlighter ───────────────────────────────────────────────────
// Instead of typing a phrase (and guessing whether it appears), just CLICK the
// words you want spotlighted. Renders the brand name + tagline as word chips;
// clicking builds a contiguous run and emits it as the highlight phrase. No
// typing, no "must appear in…" — the words are right there.
function tokenize(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function WordRow({
  label,
  words,
  activeSet,
  onToggle,
}: {
  label: string;
  words: string[];
  activeSet: Set<string>; // keys like "name:2"
  onToggle: (key: string) => void;
}) {
  if (words.length === 0) return null;
  return (
    <div>
      <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
        {label}
      </Text>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {words.map((w, i) => {
          const key = `${label}:${i}`;
          const active = activeSet.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              style={{
                padding: "3px 10px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                border: active ? "1px solid #2f4f46" : "1px solid #d9d9d9",
                background: active ? "#2f4f46" : "#fff",
                color: active ? "#fff" : "inherit",
                fontWeight: active ? 600 : 400,
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WordHighlightPicker({
  value,
  name,
  tagline,
  style,
  onChange,
  onStyle,
}: {
  value: string;
  name: string;
  tagline: string;
  style: HighlightStyle;
  onChange: (v: string) => void;
  onStyle: (s: HighlightStyle) => void;
}) {
  const nameWords = tokenize(name);
  const tagWords = tokenize(tagline);

  // The phrase is a "|"-joined list of the selected words. Light up the chips in
  // whichever row contains ALL of them (prefer the brand name), matching by word.
  const active = new Set<string>();
  const selectedWords = value
    .split("|")
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  if (selectedWords.length) {
    const markRow = (words: string[], label: string): boolean => {
      const remaining = new Set(selectedWords);
      const hits: number[] = [];
      words.forEach((w, i) => {
        const lw = w.toLowerCase();
        if (remaining.has(lw)) {
          hits.push(i);
          remaining.delete(lw);
        }
      });
      if (remaining.size === 0 && hits.length) {
        hits.forEach((i) => active.add(`${label}:${i}`));
        return true;
      }
      return false;
    };
    if (!markRow(nameWords, "Brand name")) markRow(tagWords, "Tagline");
  }

  const wordsFor = (label: string) => (label === "Brand name" ? nameWords : tagWords);

  // Per-word toggle: each click flips ONE word on/off, so you can pick adjacent
  // words ("Tech Ops") OR scattered ones ("Tech" + "help"). Selection stays in a
  // single row. The phrase is emitted as the selected words in order, joined by
  // "|" so the renderer can spotlight each word (contiguous ones merge into one
  // marker block; scattered ones emphasize separately).
  const toggle = (key: string) => {
    const [label, idxStr] = key.split(":");
    const idx = Number(idxStr);
    const words = wordsFor(label);
    const cur = new Set(
      words.map((_, i) => i).filter((i) => active.has(`${label}:${i}`)),
    );
    if (cur.has(idx)) cur.delete(idx);
    else cur.add(idx);
    const ordered = [...cur].sort((x, y) => x - y).map((i) => words[i]);
    onChange(ordered.join("|"));
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Click a word to spotlight it — click another to extend the run (the words
        between are included). Shows on the <b>Highlight</b> banner layout.
      </Text>
      <WordRow label="Brand name" words={nameWords} activeSet={active} onToggle={toggle} />
      <WordRow label="Tagline" words={tagWords} activeSet={active} onToggle={toggle} />
      {value.trim() && (
        <>
          <div>
            <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Style
            </Text>
            <Segmented
              size="small"
              value={style}
              onChange={(v) => onStyle(v as HighlightStyle)}
              options={HIGHLIGHT_STYLES.map((h) => ({ label: h.label, value: h.id }))}
            />
          </div>
          <Space size={6}>
            <Text type="success" style={{ fontSize: 12 }}>
              Highlighting {value.split("|").map((w) => `"${w}"`).join(" ")}
            </Text>
            <Button size="small" type="link" onClick={() => onChange("")} style={{ padding: 0 }}>
              Clear
            </Button>
          </Space>
        </>
      )}
    </Space>
  );
}

// ── Contact bar (bottom business strip) ──────────────────────────────────────
export function ContactBarControls({
  enabled,
  website,
  phone,
  cta,
  onToggle,
  onWebsite,
  onPhone,
  onCta,
}: {
  enabled: boolean;
  website: string;
  phone: string;
  cta: string;
  onToggle: (on: boolean) => void;
  onWebsite: (v: string) => void;
  onPhone: (v: string) => void;
  onCta: (v: string) => void;
}) {
  return (
    <Space direction="vertical" style={{ width: "100%" }} size={10}>
      <Space>
        <Switch checked={enabled} onChange={onToggle} />
        <Text>Contact bar along the bottom</Text>
      </Space>
      {enabled && (
        <>
          <Input
            addonBefore="Web"
            placeholder="www.yourbrand.com"
            value={website}
            onChange={(e) => onWebsite(e.target.value)}
            allowClear
          />
          <Input
            addonBefore="Phone"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            allowClear
          />
          <Input
            addonBefore="Button"
            placeholder="Get Started (optional CTA pill)"
            value={cta}
            onChange={(e) => onCta(e.target.value)}
            allowClear
          />
        </>
      )}
    </Space>
  );
}
