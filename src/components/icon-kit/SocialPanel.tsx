import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  App,
  Button,
  Card,
  ColorPicker,
  Input,
  Radio,
  Slider,
  Space,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";

import { canvasToBlob, renderSocial, type SocialBg, type SocialLayout, type SocialOpts } from "../../lib/icon-kit/canvas";
import { downloadBlob } from "../../lib/icon-kit/download";

type BgKind = "solid" | "gradient" | "image";

interface State {
  headline: string;
  subhead: string;
  logoDataUrl: string | null;
  layout: SocialLayout;
  bgKind: BgKind;
  solidColor: string;
  gradFrom: string;
  gradTo: string;
  gradAngle: number;
  bgImage: string | null;
  overlay: number;
  textColor: string;
}

const initial: State = {
  headline: "Ship icons in seconds",
  subhead: "A tiny browser tool for favicons and OG images.",
  logoDataUrl: null,
  layout: "centered",
  bgKind: "gradient",
  solidColor: "#2f4f46",
  gradFrom: "#2f4f46",
  gradTo: "#7fb59c",
  gradAngle: 135,
  bgImage: null,
  overlay: 0.35,
  textColor: "#ffffff",
};

type Action = { type: "patch"; patch: Partial<State> };
function reducer(s: State, a: Action): State {
  return { ...s, ...a.patch };
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

export function SocialPanel() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [busy, setBusy] = useState(false);
  const { message } = App.useApp();
  const previewWrap = useRef<HTMLDivElement>(null);

  const opts: SocialOpts = useMemo(
    () => ({
      headline: state.headline,
      subhead: state.subhead,
      logoDataUrl: state.logoDataUrl ?? undefined,
      background: buildBg(state),
      layout: state.layout,
      textColor: state.textColor,
    }),
    [state],
  );

  useEffect(() => {
    let alive = true;
    if (!previewWrap.current) return;
    (async () => {
      const canvas = await renderSocial(opts);
      if (!alive || !previewWrap.current) return;
      previewWrap.current.innerHTML = "";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.borderRadius = "8px";
      canvas.style.display = "block";
      previewWrap.current.appendChild(canvas);
    })();
    return () => {
      alive = false;
    };
  }, [opts]);

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

  async function handleDownload() {
    setBusy(true);
    try {
      const c = await renderSocial(opts);
      const blob = await canvasToBlob(c);
      downloadBlob(blob, "og-image.png");
      message.success("Downloaded og-image.png");
    } catch (e) {
      console.error(e);
      message.error("Could not generate the image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card size="small" title="1. Text">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            placeholder="Headline"
            value={state.headline}
            onChange={(e) => dispatch({ type: "patch", patch: { headline: e.target.value } })}
          />
          <Input
            placeholder="Subhead (optional)"
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

      <Card size="small" title="4. Layout">
        <Radio.Group
          value={state.layout}
          onChange={(e) => dispatch({ type: "patch", patch: { layout: e.target.value } })}
        >
          <Radio.Button value="centered">Centered</Radio.Button>
          <Radio.Button value="logo-tl">Logo TL + Left</Radio.Button>
          <Radio.Button value="split">Split</Radio.Button>
        </Radio.Group>
      </Card>

      <Card size="small" title="Preview (1200×630)">
        <div ref={previewWrap} style={{ width: "100%", aspectRatio: "1200 / 630", background: "#eee", borderRadius: 8 }} />
      </Card>

      <Button
        type="primary"
        size="large"
        icon={<DownloadOutlined />}
        loading={busy}
        onClick={handleDownload}
        block
      >
        Download og-image.png
      </Button>

      <Card size="small" title="<head> snippet">
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
    </Space>
  );
}