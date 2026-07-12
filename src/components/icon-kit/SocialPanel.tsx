import { useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  Checkbox,
  ColorPicker,
  Input,
  Radio,
  Slider,
  Space,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import { DownloadOutlined, InboxOutlined, ExportOutlined } from "@ant-design/icons";

import {
  BANNER_SIZES,
  canvasToBlob,
  renderBanner,
  renderSocial,
  type BannerLayout,
  type BannerPlatform,
  type SocialBg,
  type SocialLayout,
} from "../../lib/icon-kit/canvas";
import { downloadBlob } from "../../lib/icon-kit/download";
import { usePersistentReducer } from "../../hooks/use-persistent-reducer";

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

interface State {
  // Shared content — entered once, drives every preview.
  headline: string;
  subhead: string;
  logoDataUrl: string | null;
  bgKind: BgKind;
  solidColor: string;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  bgImage: string | null;
  overlay: number;
  textColor: string;
  // Per-output layout choices.
  layouts: Record<OutputId, AnyLayout>;
  // Which outputs are selected for export / download-all.
  selected: Record<OutputId, boolean>;
}

const initial: State = {
  headline: "Acme Studio",
  subhead: "Design that ships.",
  logoDataUrl: null,
  bgKind: "gradient",
  solidColor: "#2f4f46",
  gradFrom: "#2f4f46",
  gradTo: "#7fb59c",
  gradAngle: 135,
  bgImage: null,
  overlay: 0.35,
  textColor: "#ffffff",
  layouts: { og: "centered", linkedin: "left", facebook: "centered", twitter: "left" },
  selected: { og: true, linkedin: true, facebook: true, twitter: true },
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
  return { type: "image", dataUrl: s.bgImage || "", overlay: s.overlay };
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
  if (out.id === "og") {
    return renderSocial({
      headline: s.headline,
      subhead: s.subhead,
      logoDataUrl: s.logoDataUrl ?? undefined,
      background,
      layout: s.layouts.og as SocialLayout,
      textColor: s.textColor,
    });
  }
  const size = BANNER_SIZES.find((b) => b.id === out.id)!;
  return renderBanner({
    size,
    name: s.headline,
    tagline: s.subhead,
    logoDataUrl: s.logoDataUrl ?? undefined,
    background,
    layout: s.layouts[out.id] as BannerLayout,
    textColor: s.textColor,
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
        s: state.subhead,
        logo: state.logoDataUrl,
        bg: buildBg(state),
        tc: state.textColor,
        layout: state.layouts[out.id],
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
            </>
          )}
        </Radio.Group>
      </Space>
    </Card>
  );
}

export function SocialPanel() {
  const [state, dispatch] = usePersistentReducer("iconkit.social.v1", reducer, initial);
  const [busy, setBusy] = useState(false);
  const { message } = App.useApp();

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

  // Export to Brand Board: emit the `type:"social"` payload the board consumes —
  // a generic list of labeled image assets, one per SELECTED output. Each carries
  // its rendered PNG (as a data URL), a board label, a kind hint, and dimensions
  // so the board sizes wide banners full-width and the card compact. One paste
  // brings the whole selection over. Matches BRAND-KIT-INTEROP-CONTRACT §5.
  async function exportToBrandBoard() {
    if (selectedOutputs.length === 0) {
      message.info("Select at least one size to export");
      return;
    }
    setBusy(true);
    try {
      const assets = [];
      for (const out of selectedOutputs) {
        const c = await renderOutput(out, state);
        const blob = await canvasToBlob(c);
        const image = await blobToDataUrl(blob);
        assets.push({
          image,
          label: out.boardLabel,
          kind: out.boardKind,
          width: out.w,
          height: out.h,
        });
      }
      const payload = { type: "social", v: 1, source: "opsette", data: { assets } };
      await navigator.clipboard.writeText(JSON.stringify(payload));
      message.success(
        `Copied ${assets.length} asset(s) — paste into Brand Board's Social field`,
      );
    } catch (e) {
      console.error(e);
      message.error("Could not export to Brand Board");
    } finally {
      setBusy(false);
    }
  }

  const allSelected = OUTPUTS.every((o) => state.selected[o.id]);
  const someSelected = OUTPUTS.some((o) => state.selected[o.id]);
  const ogSelected = state.selected.og;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
        Design once — every size renders below. Check the ones you want, then
        download them or export the set to Brand Board.
      </Typography.Paragraph>

      <Card size="small" title="1. Brand name & tagline">
        <Space direction="vertical" style={{ width: "100%" }}>
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
          <Space>
            <span>Text color</span>
            <ColorPicker
              value={state.textColor}
              onChange={(c) => dispatch({ type: "patch", patch: { textColor: c.toHexString() } })}
            />
          </Space>
        </Space>
      </Card>

      <Card size="small" title="2. Logo (optional)">
        <Space>
          <Upload {...logoUpload}>
            <Button icon={<InboxOutlined />}>Upload logo</Button>
          </Upload>
          {state.logoDataUrl && (
            <Button
              type="link"
              onClick={() => dispatch({ type: "patch", patch: { logoDataUrl: null } })}
            >
              Remove
            </Button>
          )}
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
            <Space direction="vertical" style={{ width: "100%" }}>
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
            </Space>
          )}
        </Space>
      </Card>

      <Card
        size="small"
        title="4. Previews"
        extra={
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
        }
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
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
        <Button
          type="primary"
          size="large"
          icon={<ExportOutlined />}
          loading={busy}
          onClick={exportToBrandBoard}
          disabled={!someSelected}
          block
        >
          Export selected to Brand Board
        </Button>
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
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
