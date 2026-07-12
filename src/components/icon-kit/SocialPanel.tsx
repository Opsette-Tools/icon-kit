import { useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Checkbox,
  ColorPicker,
  Input,
  Modal,
  Radio,
  Slider,
  Space,
  Switch,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import { DownloadOutlined, InboxOutlined, FolderOpenOutlined } from "@ant-design/icons";

import {
  BANNER_SIZES,
  canvasToBlob,
  renderBanner,
  renderSocial,
  type BannerLayout,
  type BannerPlatform,
  type DesignLayers,
  type SocialBg,
  type SocialLayout,
} from "../../lib/icon-kit/canvas";
import {
  DEFAULT_FONT_ID,
  getFontPair,
  loadFontPair,
  mixHex,
  type HighlightStyle,
  type TextureKind,
  type WatermarkEdge,
} from "../../lib/icon-kit/social-design";
import { fromSocialKitJson, type SocialAsset } from "../../lib/icon-kit/brand-kit";
import { ExportToBoardButton } from "./ExportToBoardButton";
import { downloadBlob, blobToDataUrl } from "../../lib/icon-kit/download";
import { usePersistentReducer } from "../../hooks/use-persistent-reducer";
import {
  ContactBarControls,
  ContrastShield,
  DuotoneControls,
  FontPicker,
  PhotoPanelControls,
  TexturePicker,
  WatermarkControls,
  WordHighlightPicker,
} from "./social-controls";
import { SafeZoneOverlay } from "./SafeZoneOverlay";

type BgKind = "solid" | "gradient" | "image";

// Every output the panel can produce. The OG card and the three banners all draw
// from ONE shared config — the only thing that differs is which renderer + size,
// and each output's own layout choice. That's the whole point of the redesign:
// build the design once, get every platform at once.
type OutputId = "og" | BannerPlatform;

interface OutputDef {
  id: OutputId;
  label: string;
  w: number;
  h: number;
  file: string;
  kind: "card" | "banner";
  /** Board asset label + hint when exported. */
  boardLabel: string;
  boardKind: string;
}

const OUTPUTS: OutputDef[] = [
  {
    id: "og",
    label: "Social card",
    w: 1200,
    h: 630,
    file: "og-image.png",
    kind: "card",
    boardLabel: "Social card",
    boardKind: "card",
  },
  ...BANNER_SIZES.map<OutputDef>((b) => ({
    id: b.id,
    label: b.label,
    w: b.w,
    h: b.h,
    file: b.file,
    kind: "banner",
    boardLabel: `${b.label} banner`,
    boardKind: "banner",
  })),
];

// Per-output layout. OG has three layouts; banners have two. We keep a layout
// choice per output id so tuning the wide LinkedIn strip doesn't disturb the card.
type AnyLayout = SocialLayout | BannerLayout;

export interface SocialState {
  // Shared content — entered once, drives every preview.
  headline: string;
  eyebrow: string;
  subhead: string;
  fontId: string;
  logoDataUrl: string | null;
  bgKind: BgKind;
  solidColor: string;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  bgImage: string | null;
  overlay: number;
  duotone: boolean;
  duoShadow: string;
  duoHighlight: string;
  textColor: string;
  // Design layers.
  accentColor: string;
  texture: TextureKind;
  watermark: boolean;
  watermarkEdge: WatermarkEdge;
  watermarkOpacity: number;
  watermarkScale: number;
  // Photo panel (banner photo-panel layout) — a person/product photo carved
  // into one side. Separate from the OG-card background photo above.
  panelPhoto: string | null;
  photoSide: "left" | "right";
  photoDivider: "straight" | "diagonal" | "curve";
  photoZoom: number; // 1..2.5
  photoFocusX: number; // 0..1
  photoFocusY: number; // 0..1
  // Highlight phrase — words in the name/tagline spotlighted, + how.
  highlightPhrase: string;
  highlightStyle: HighlightStyle;
  // Contact bar (bottom business strip) — any layout.
  contactBar: boolean;
  contactWebsite: string;
  contactPhone: string;
  contactCta: string;
  // Per-output layout choices.
  layouts: Record<OutputId, AnyLayout>;
  // Which outputs are selected for export / download-all.
  selected: Record<OutputId, boolean>;
  // Preview-only guide.
  showSafeZone: boolean;
}
// Local alias so the rest of this file reads unchanged.
type State = SocialState;

export const SOCIAL_KEY = "iconkit.social.v2";
export const socialInitial: State = {
  headline: "Acme Studio",
  eyebrow: "Brand & Web Design",
  subhead: "Design that ships.",
  fontId: DEFAULT_FONT_ID,
  logoDataUrl: null,
  bgKind: "gradient",
  solidColor: "#2f4f46",
  gradFrom: "#2f4f46",
  gradTo: "#7fb59c",
  gradAngle: 135,
  bgImage: null,
  overlay: 0.35,
  duotone: false,
  duoShadow: "#1c332c",
  duoHighlight: "#e8f2ec",
  textColor: "#ffffff",
  accentColor: "#a7d7c2",
  texture: "corner-blob",
  watermark: false,
  watermarkEdge: "right",
  watermarkOpacity: 0.1,
  watermarkScale: 1.4,
  panelPhoto: null,
  photoSide: "left",
  photoDivider: "diagonal",
  photoZoom: 1,
  photoFocusX: 0.5,
  photoFocusY: 0.35,
  highlightPhrase: "",
  highlightStyle: "bold",
  contactBar: false,
  contactWebsite: "www.yourbrand.com",
  contactPhone: "+1 555 123 4567",
  contactCta: "Get Started",
  layouts: { og: "centered", linkedin: "left", facebook: "centered", twitter: "left" },
  selected: { og: true, linkedin: true, facebook: true, twitter: true },
  showSafeZone: true,
};

type Action =
  | { type: "patch"; patch: Partial<State> }
  | { type: "setLayout"; id: OutputId; layout: AnyLayout }
  | { type: "toggle"; id: OutputId; on: boolean };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "patch":
      return { ...s, ...a.patch };
    case "setLayout":
      return { ...s, layouts: { ...s.layouts, [a.id]: a.layout } };
    case "toggle":
      return { ...s, selected: { ...s.selected, [a.id]: a.on } };
  }
}

function buildBg(s: State): SocialBg {
  if (s.bgKind === "solid") return { type: "solid", color: s.solidColor };
  if (s.bgKind === "gradient")
    return { type: "gradient", from: s.gradFrom, to: s.gradTo, angle: s.gradAngle };
  return {
    type: "image",
    dataUrl: s.bgImage || "",
    overlay: s.overlay,
    duotone: s.duotone ? { shadow: s.duoShadow, highlight: s.duoHighlight } : undefined,
  };
}

// The design-layers bundle both renderers read. Assembled once from state so the
// panel never hand-passes the same fields in two places.
function buildDesign(s: State): DesignLayers {
  return {
    fontId: s.fontId,
    eyebrow: s.eyebrow,
    accentColor: s.accentColor,
    texture: s.texture,
    watermark:
      s.watermark && s.logoDataUrl
        ? {
            dataUrl: s.logoDataUrl,
            edge: s.watermarkEdge,
            opacity: s.watermarkOpacity,
            scale: s.watermarkScale,
          }
        : undefined,
  };
}

// The dominant background color, used by the contrast guardrail. For a gradient
// we approximate with the mid-mix of the two stops; for a photo the overlay
// darkens it, so we bias toward black.
function dominantBg(s: State): string {
  if (s.bgKind === "solid") return s.solidColor;
  if (s.bgKind === "gradient") return mixHex(s.gradFrom, s.gradTo);
  // photo: overlay darkens; approximate with a dark tone scaled by overlay.
  return s.overlay >= 0.4 ? "#1a1a1a" : mixHex(s.duoShadow, s.duoHighlight);
}

function metaSnippet(headline: string, subhead: string) {
  const desc = subhead || headline;
  return `<meta property="og:title" content="${escapeAttr(headline)}">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:image" content="/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(headline)}">
<meta name="twitter:description" content="${escapeAttr(desc)}">
<meta name="twitter:image" content="/og-image.png">`;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render one output to a canvas. OG uses renderSocial (photo bg allowed); banners
// use renderBanner. Banners force solid/gradient (image bg falls back inside the
// renderer), so a photo background only affects the OG card.
async function renderOutput(out: OutputDef, s: State): Promise<HTMLCanvasElement> {
  const background = buildBg(s);
  const design = buildDesign(s);
  if (out.id === "og") {
    return renderSocial({
      headline: s.headline,
      subhead: s.subhead,
      logoDataUrl: s.logoDataUrl ?? undefined,
      background,
      layout: s.layouts.og as SocialLayout,
      textColor: s.textColor,
      design,
    });
  }
  const size = BANNER_SIZES.find((b) => b.id === out.id)!;
  const layout = s.layouts[out.id] as BannerLayout;
  const contactBar =
    s.contactBar && (s.contactWebsite.trim() || s.contactPhone.trim() || s.contactCta.trim())
      ? {
          website: s.contactWebsite.trim() || undefined,
          phone: s.contactPhone.trim() || undefined,
          cta: s.contactCta.trim() || undefined,
        }
      : undefined;
  return renderBanner({
    size,
    name: s.headline,
    tagline: s.subhead,
    logoDataUrl: s.logoDataUrl ?? undefined,
    background,
    layout,
    textColor: s.textColor,
    design,
    photo:
      layout === "photo-panel" && s.panelPhoto
        ? {
            dataUrl: s.panelPhoto,
            side: s.photoSide,
            divider: s.photoDivider,
            zoom: s.photoZoom,
            focusX: s.photoFocusX,
            focusY: s.photoFocusY,
          }
        : undefined,
    highlightPhrase: s.highlightPhrase.trim() || undefined,
    highlightStyle: s.highlightStyle,
    contactBar,
  });
}

// Build the export assets from the SELECTED outputs — each a rendered PNG data
// URL with a board label, kind hint and natural dimensions. Shared by the panel's
// own export button and the App-level combined export. Returns [] if nothing's
// selected.
export async function buildSocialAssets(s: State): Promise<SocialAsset[]> {
  const selected = OUTPUTS.filter((o) => s.selected[o.id]);
  const assets: SocialAsset[] = [];
  for (const out of selected) {
    const canvas = await renderOutput(out, s);
    const blob = await canvasToBlob(canvas);
    const image = await blobToDataUrl(blob);
    assets.push({ image, label: out.boardLabel, kind: out.boardKind, width: out.w, height: out.h });
  }
  return assets;
}

// Has the user meaningfully touched the banner builder? We ignore the transient
// view-only fields (selection checkboxes, safe-zone toggle) — only real design
// content counts, so an untouched-but-glanced-at tab isn't treated as "made."
export function socialIsDirty(s: State): boolean {
  const skip = new Set<keyof State>(["selected", "showSafeZone"]);
  return (Object.keys(socialInitial) as (keyof State)[]).some((key) => {
    if (skip.has(key)) return false;
    return JSON.stringify(s[key]) !== JSON.stringify(socialInitial[key]);
  });
}

// A single preview tile: live canvas + select checkbox + per-tile layout + download.
function PreviewTile({
  out,
  state,
  dispatch,
  onDownload,
}: {
  out: OutputDef;
  state: State;
  dispatch: React.Dispatch<Action>;
  onDownload: (out: OutputDef) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // Only re-render this tile when something that affects IT changes.
  const key = useMemo(
    () =>
      JSON.stringify({
        h: state.headline,
        e: state.eyebrow,
        s: state.subhead,
        f: state.fontId,
        logo: state.logoDataUrl,
        bg: buildBg(state),
        tc: state.textColor,
        design: buildDesign(state),
        layout: state.layouts[out.id],
        photo: state.panelPhoto,
        pside: state.photoSide,
        pdiv: state.photoDivider,
        pzoom: state.photoZoom,
        pfx: state.photoFocusX,
        pfy: state.photoFocusY,
        hl: state.highlightPhrase,
        hls: state.highlightStyle,
        cb: state.contactBar,
        cw: state.contactWebsite,
        cp: state.contactPhone,
        cc: state.contactCta,
      }),
    [state, out.id],
  );

  useEffect(() => {
    let alive = true;
    if (!wrap.current) return;
    (async () => {
      const canvas = await renderOutput(out, state);
      if (!alive || !wrap.current) return;
      wrap.current.innerHTML = "";
      // Let the canvas define its own size: full container width, height derived
      // from its intrinsic ratio. No competing aspect-ratio box on the wrapper
      // (that left a white sliver when the two ratios disagreed by a pixel).
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.borderRadius = "6px";
      canvas.style.display = "block";
      wrap.current.appendChild(canvas);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isOg = out.id === "og";
  const showGuide = !isOg && state.showSafeZone;

  return (
    <Card
      size="small"
      styles={{ body: { padding: 12 } }}
      style={{ borderColor: state.selected[out.id] ? "#2f4f46" : undefined }}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Checkbox
            checked={state.selected[out.id]}
            onChange={(e) => dispatch({ type: "toggle", id: out.id, on: e.target.checked })}
          >
            <strong>{out.label}</strong>{" "}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {out.w}×{out.h}
            </Typography.Text>
          </Checkbox>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => onDownload(out)}>
            PNG
          </Button>
        </div>

        <div style={{ position: "relative", width: "100%" }}>
          <div
            ref={wrap}
            style={{
              width: "100%",
              // Reserve height by ratio only until the canvas paints, then the
              // canvas (width:100%, height:auto) governs. No bg fill so nothing
              // shows through beside the image.
              minHeight: 1,
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid #f0f0f0",
            }}
          />
          {showGuide && <SafeZoneOverlay platform={out.id as BannerPlatform} />}
        </div>

        <Radio.Group
          size="small"
          value={state.layouts[out.id]}
          onChange={(e) => dispatch({ type: "setLayout", id: out.id, layout: e.target.value })}
        >
          {isOg ? (
            <>
              <Radio.Button value="centered">Centered</Radio.Button>
              <Radio.Button value="logo-tl">Logo TL</Radio.Button>
              <Radio.Button value="split">Split</Radio.Button>
            </>
          ) : (
            <>
              <Radio.Button value="left">Left</Radio.Button>
              <Radio.Button value="centered">Centered</Radio.Button>
              <Radio.Button value="photo-panel">Photo</Radio.Button>
              <Radio.Button value="highlight">Highlight</Radio.Button>
            </>
          )}
        </Radio.Group>
        {!isOg && state.layouts[out.id] === "photo-panel" && !state.panelPhoto && (
          <Typography.Text type="warning" style={{ fontSize: 12 }}>
            Upload a panel photo below (card 5) to fill the photo side.
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}

export function SocialPanel() {
  const [state, dispatch] = usePersistentReducer(SOCIAL_KEY, reducer, socialInitial);
  const [busy, setBusy] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenText, setReopenText] = useState("");
  const { message } = App.useApp();

  // Load the chosen font pairing so previews draw with it (idempotent).
  useEffect(() => {
    loadFontPair(getFontPair(state.fontId));
  }, [state.fontId]);

  const selectedOutputs = OUTPUTS.filter((o) => state.selected[o.id]);

  const logoUpload: UploadProps = {
    accept: "image/png,image/jpeg,image/svg+xml",
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        dispatch({ type: "patch", patch: { logoDataUrl: String(e.target?.result || "") } });
      reader.readAsDataURL(file);
      return false;
    },
  };

  const bgUpload: UploadProps = {
    accept: "image/png,image/jpeg",
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        dispatch({ type: "patch", patch: { bgImage: String(e.target?.result || "") } });
      reader.readAsDataURL(file);
      return false;
    },
  };

  const panelPhotoUpload: UploadProps = {
    accept: "image/png,image/jpeg",
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        dispatch({ type: "patch", patch: { panelPhoto: String(e.target?.result || "") } });
      reader.readAsDataURL(file);
      return false;
    },
  };

  async function downloadOne(out: OutputDef) {
    try {
      const c = await renderOutput(out, state);
      const blob = await canvasToBlob(c);
      downloadBlob(blob, out.file);
      message.success(`Downloaded ${out.file}`);
    } catch (e) {
      console.error(e);
      message.error("Could not generate the image");
    }
  }

  async function downloadSelected() {
    if (selectedOutputs.length === 0) {
      message.info("Select at least one size to download");
      return;
    }
    setBusy(true);
    try {
      for (const out of selectedOutputs) {
        const c = await renderOutput(out, state);
        const blob = await canvasToBlob(c);
        downloadBlob(blob, out.file);
      }
      message.success(`Downloaded ${selectedOutputs.length} image(s)`);
    } catch (e) {
      console.error(e);
      message.error("Could not generate the images");
    } finally {
      setBusy(false);
    }
  }

  // Reopen: paste a previously exported `social` blob to restore the full design.
  // Strict on the envelope; if the blob predates the `config` field (older
  // exports carried only images), we say so rather than silently doing nothing.
  function reopenFromBlob(raw: string): boolean {
    const parsed = fromSocialKitJson(raw);
    if (!parsed) {
      message.error("That doesn't look like an Icon Kit social export.");
      return false;
    }
    const config = parsed.data.config;
    if (!config) {
      message.warning(
        "This blob has the images but no saved design settings (exported before reopen existed). Re-export from a current design to reopen it losslessly.",
      );
      return false;
    }
    // Merge onto current state — patch reducer spreads it, so any fields the blob
    // is missing keep their current value. Restores name/font/watermark/texture/
    // photo/highlight/layouts/contact bar — everything.
    dispatch({ type: "patch", patch: config as Partial<typeof state> });
    message.success("Design reopened — every control is restored.");
    return true;
  }

  const allSelected = OUTPUTS.every((o) => state.selected[o.id]);
  const someSelected = OUTPUTS.some((o) => state.selected[o.id]);
  const ogSelected = state.selected.og;

  return (
    <div className="social-layout">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13, flex: 1, minWidth: 220 }}>
          Design once — every size renders on the right. Check the ones you want,
          then download them or export the set to Brand Board.
        </Typography.Paragraph>
        <Button icon={<FolderOpenOutlined />} onClick={() => setReopenOpen(true)}>
          Reopen a saved design
        </Button>
      </div>

      <Modal
        title="Reopen a saved design"
        open={reopenOpen}
        onCancel={() => {
          setReopenOpen(false);
          setReopenText("");
        }}
        okText="Reopen"
        onOk={() => {
          if (reopenFromBlob(reopenText)) {
            setReopenOpen(false);
            setReopenText("");
          }
        }}
        okButtonProps={{ disabled: !reopenText.trim() }}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          Paste an <b>Export to Brand Board</b> blob (from this tool) to rebuild
          the whole design — name, fonts, background, watermark, texture, photo,
          highlight, layouts and contact bar. It's the same blob you'd paste into
          Brand Board.
        </Typography.Paragraph>
        <Input.TextArea
          rows={6}
          value={reopenText}
          onChange={(e) => setReopenText(e.target.value)}
          placeholder='{"type":"social","v":1,"source":"opsette","data":{...}}'
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
        />
      </Modal>

      {/* Two-column: controls left, sticky previews + actions right. Collapses to
          a single stacked column on mobile via .social-split (see styles.css). */}
      <div className="social-split">
        <Space direction="vertical" size={16} style={{ width: "100%" }} className="social-controls-col">
          <Card size="small" title="1. Brand name & type">
        <Space direction="vertical" style={{ width: "100%" }} size={10}>
          <Input
            placeholder="Eyebrow — role or location (optional)"
            value={state.eyebrow}
            onChange={(e) => dispatch({ type: "patch", patch: { eyebrow: e.target.value } })}
            maxLength={40}
          />
          <Input
            placeholder="Brand name / headline"
            value={state.headline}
            onChange={(e) => dispatch({ type: "patch", patch: { headline: e.target.value } })}
          />
          <Input
            placeholder="Tagline / subhead (optional)"
            value={state.subhead}
            onChange={(e) => dispatch({ type: "patch", patch: { subhead: e.target.value } })}
          />
          <div
            style={{
              border: "1px dashed #e0e0e0",
              borderRadius: 8,
              padding: "10px 12px",
              background: "#fafafa",
            }}
          >
            <WordHighlightPicker
              value={state.highlightPhrase}
              name={state.headline}
              tagline={state.subhead}
              style={state.highlightStyle}
              onChange={(v) => dispatch({ type: "patch", patch: { highlightPhrase: v } })}
              onStyle={(s) => dispatch({ type: "patch", patch: { highlightStyle: s } })}
            />
          </div>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Font pairing — eyebrow → name → tagline
            </Typography.Text>
            <div style={{ marginTop: 4 }}>
              <FontPicker
                value={state.fontId}
                onChange={(id) => dispatch({ type: "patch", patch: { fontId: id } })}
              />
            </div>
          </div>
          <Space>
            <span>Text color</span>
            <ColorPicker
              value={state.textColor}
              onChange={(c) => dispatch({ type: "patch", patch: { textColor: c.toHexString() } })}
            />
          </Space>
          <ContrastShield
            textColor={state.textColor}
            bgColor={dominantBg(state)}
            onFix={(color) => dispatch({ type: "patch", patch: { textColor: color } })}
          />
        </Space>
      </Card>

      <Card size="small" title="2. Logo (optional)">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Space>
            <Upload {...logoUpload}>
              <Button icon={<InboxOutlined />}>Upload logo</Button>
            </Upload>
            {state.logoDataUrl && (
              <Button
                type="link"
                onClick={() =>
                  dispatch({ type: "patch", patch: { logoDataUrl: null, watermark: false } })
                }
              >
                Remove
              </Button>
            )}
          </Space>
          <WatermarkControls
            enabled={state.watermark}
            edge={state.watermarkEdge}
            opacity={state.watermarkOpacity}
            scale={state.watermarkScale}
            hasLogo={Boolean(state.logoDataUrl)}
            onToggle={(on) => dispatch({ type: "patch", patch: { watermark: on } })}
            onEdge={(e) => dispatch({ type: "patch", patch: { watermarkEdge: e } })}
            onOpacity={(v) => dispatch({ type: "patch", patch: { watermarkOpacity: v } })}
            onScale={(v) => dispatch({ type: "patch", patch: { watermarkScale: v } })}
          />
        </Space>
      </Card>

      <Card size="small" title="3. Background">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Radio.Group
            value={state.bgKind}
            onChange={(e) => dispatch({ type: "patch", patch: { bgKind: e.target.value } })}
          >
            <Radio.Button value="solid">Solid</Radio.Button>
            <Radio.Button value="gradient">Gradient</Radio.Button>
            <Radio.Button value="image">Image</Radio.Button>
          </Radio.Group>

          {state.bgKind === "solid" && (
            <Space>
              <span>Color</span>
              <ColorPicker
                value={state.solidColor}
                onChange={(c) => dispatch({ type: "patch", patch: { solidColor: c.toHexString() } })}
              />
            </Space>
          )}
          {state.bgKind === "gradient" && (
            <Space wrap>
              <Space>
                <span>From</span>
                <ColorPicker
                  value={state.gradFrom}
                  onChange={(c) => dispatch({ type: "patch", patch: { gradFrom: c.toHexString() } })}
                />
              </Space>
              <Space>
                <span>To</span>
                <ColorPicker
                  value={state.gradTo}
                  onChange={(c) => dispatch({ type: "patch", patch: { gradTo: c.toHexString() } })}
                />
              </Space>
              <div style={{ minWidth: 180 }}>
                <Typography.Text type="secondary">Angle — {state.gradAngle}°</Typography.Text>
                <Slider
                  min={0}
                  max={360}
                  value={state.gradAngle}
                  onChange={(v) => dispatch({ type: "patch", patch: { gradAngle: v as number } })}
                />
              </div>
            </Space>
          )}
          {state.bgKind === "image" && (
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Upload {...bgUpload}>
                <Button icon={<InboxOutlined />}>
                  {state.bgImage ? "Replace image" : "Upload background"}
                </Button>
              </Upload>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Photo background applies to the Social card only — banners use the
                solid/gradient color.
              </Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  Darken — {Math.round(state.overlay * 100)}%
                </Typography.Text>
                <Slider
                  min={0}
                  max={80}
                  value={Math.round(state.overlay * 100)}
                  onChange={(v) =>
                    dispatch({ type: "patch", patch: { overlay: (v as number) / 100 } })
                  }
                />
              </div>
              <DuotoneControls
                enabled={state.duotone}
                shadow={state.duoShadow}
                highlight={state.duoHighlight}
                onToggle={(on) => dispatch({ type: "patch", patch: { duotone: on } })}
                onShadow={(c) => dispatch({ type: "patch", patch: { duoShadow: c } })}
                onHighlight={(c) => dispatch({ type: "patch", patch: { duoHighlight: c } })}
              />
            </Space>
          )}
        </Space>
      </Card>

      <Card size="small" title="4. Texture & accent">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              One subtle shape layer
            </Typography.Text>
            <div style={{ marginTop: 4 }}>
              <TexturePicker
                value={state.texture}
                onChange={(t) => dispatch({ type: "patch", patch: { texture: t } })}
              />
            </div>
          </div>
          <Space>
            <span>Accent color</span>
            <ColorPicker
              value={state.accentColor}
              onChange={(c) => dispatch({ type: "patch", patch: { accentColor: c.toHexString() } })}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              tints the texture
            </Typography.Text>
          </Space>
        </Space>
      </Card>

      <Card size="small" title="5. Photo panel & contact bar">
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Photo panel
            </Typography.Text>
            <div style={{ marginTop: 6 }}>
              <PhotoPanelControls
                photo={state.panelPhoto}
                side={state.photoSide}
                divider={state.photoDivider}
                zoom={state.photoZoom}
                focusX={state.photoFocusX}
                focusY={state.photoFocusY}
                upload={panelPhotoUpload}
                onRemove={() => dispatch({ type: "patch", patch: { panelPhoto: null } })}
                onSide={(s) => dispatch({ type: "patch", patch: { photoSide: s } })}
                onDivider={(d) => dispatch({ type: "patch", patch: { photoDivider: d } })}
                onZoom={(v) => dispatch({ type: "patch", patch: { photoZoom: v } })}
                onFocus={(x, y) => dispatch({ type: "patch", patch: { photoFocusX: x, photoFocusY: y } })}
              />
            </div>
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Contact bar
            </Typography.Text>
            <div style={{ marginTop: 6 }}>
              <ContactBarControls
                enabled={state.contactBar}
                website={state.contactWebsite}
                phone={state.contactPhone}
                cta={state.contactCta}
                onToggle={(on) => dispatch({ type: "patch", patch: { contactBar: on } })}
                onWebsite={(v) => dispatch({ type: "patch", patch: { contactWebsite: v } })}
                onPhone={(v) => dispatch({ type: "patch", patch: { contactPhone: v } })}
                onCta={(v) => dispatch({ type: "patch", patch: { contactCta: v } })}
              />
            </div>
          </div>
        </Space>
      </Card>
        </Space>

        <div className="social-preview-col">
          <Space direction="vertical" size={16} style={{ width: "100%" }} className="social-preview-inner">
      <Card
        size="small"
        title="6. Previews"
        extra={
          <Space size={12}>
            <Space size={4}>
              <Switch
                size="small"
                checked={state.showSafeZone}
                onChange={(v) => dispatch({ type: "patch", patch: { showSafeZone: v } })}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Avatar guide
              </Typography.Text>
            </Space>
            <Checkbox
              indeterminate={someSelected && !allSelected}
              checked={allSelected}
              onChange={(e) =>
                dispatch({
                  type: "patch",
                  patch: {
                    selected: {
                      og: e.target.checked,
                      linkedin: e.target.checked,
                      facebook: e.target.checked,
                      twitter: e.target.checked,
                    },
                  },
                })
              }
            >
              Select all
            </Checkbox>
          </Space>
        }
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            The dashed circle shows where each platform drops the profile avatar —
            a preview guide only, never part of the exported image.
          </Typography.Text>
          {OUTPUTS.map((out) => (
            <PreviewTile
              key={out.id}
              out={out}
              state={state}
              dispatch={dispatch}
              onDownload={downloadOne}
            />
          ))}
        </Space>
      </Card>

      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <ExportToBoardButton scope="social" liveState={state} disabled={!someSelected} block />
        <Button
          size="large"
          icon={<DownloadOutlined />}
          loading={busy}
          onClick={downloadSelected}
          disabled={!someSelected}
          block
        >
          Download selected as PNG
        </Button>
      </Space>

      {ogSelected && (
        <Card size="small" title="<head> snippet (for the Social card)">
          <Typography.Paragraph
            copyable={{ text: metaSnippet(state.headline, state.subhead) }}
            style={{
              background: "#0e1a17",
              color: "#d8efe7",
              padding: 12,
              borderRadius: 6,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {metaSnippet(state.headline, state.subhead)}
          </Typography.Paragraph>
        </Card>
      )}
          </Space>
        </div>
      </div>
    </div>
  );
}
