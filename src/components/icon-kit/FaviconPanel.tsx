import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Button,
  Card,
  ColorPicker,
  Input,
  Radio,
  Slider,
  Space,
  Tabs,
  Typography,
  Upload,
  App,
} from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import JSZip from "jszip";

import {
  canvasToBlob,
  renderIcon,
  type BgMode,
  type IconOpts,
  type SourceSpec,
} from "../../lib/icon-kit/canvas";
import { encodeIco } from "../../lib/icon-kit/ico";
import { downloadBlob } from "../../lib/icon-kit/download";

type SourceTab = "image" | "initials" | "emoji";

interface State {
  tab: SourceTab;
  imageDataUrl: string | null;
  initialsText: string;
  initialsColor: string;
  emoji: string;
  bgMode: BgMode;
  bgColor: string;
  paddingPct: number;
  radiusPct: number;
  appName: string;
}

const initial: State = {
  tab: "initials",
  imageDataUrl: null,
  initialsText: "OP",
  initialsColor: "#ffffff",
  emoji: "🚀",
  bgMode: "tile",
  bgColor: "#2f4f46",
  paddingPct: 12,
  radiusPct: 22,
  appName: "My App",
};

type Action = { type: "patch"; patch: Partial<State> };
function reducer(s: State, a: Action): State {
  return { ...s, ...a.patch };
}

const EMOJI_PICKS = [
  "🚀","✨","🔥","⚡","🎯","🧭","🛠️","📦","🧩","💎",
  "🌿","🌊","🌞","🌙","⭐","🍃","🍋","🍒","🍩","☕",
  "📚","📈","📝","🔒","🔑","💡","🎨","🎵","📷","🏷️",
];

function buildSource(s: State): SourceSpec | null {
  if (s.tab === "image") {
    return s.imageDataUrl ? { type: "image", dataUrl: s.imageDataUrl } : null;
  }
  if (s.tab === "initials") {
    return { type: "initials", text: s.initialsText || "?", color: s.initialsColor };
  }
  return { type: "emoji", char: s.emoji || "★" };
}

function htmlSnippet() {
  return `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2f4f46">`;
}

export function FaviconPanel() {
  const [state, dispatch] = useReducer(reducer, initial);
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const source = useMemo(() => buildSource(state), [state]);

  const opts: IconOpts | null = useMemo(() => {
    if (!source) return null;
    return {
      source,
      bgMode: state.bgMode,
      bgColor: state.bgColor,
      paddingPct: state.paddingPct,
      radiusPct: state.radiusPct,
    };
  }, [source, state.bgMode, state.bgColor, state.paddingPct, state.radiusPct]);

  // Live preview
  useEffect(() => {
    let alive = true;
    if (!opts || !previewRef.current) return;
    (async () => {
      const node = previewRef.current!;
      const sizes = [128, 32, 16];
      const canvases = await Promise.all(sizes.map((s) => renderIcon(s, opts)));
      if (!alive) return;
      node.innerHTML = "";
      sizes.forEach((sz, i) => {
        const wrap = document.createElement("div");
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.alignItems = "center";
        wrap.style.gap = "6px";
        const c = canvases[i];
        c.style.width = `${sz}px`;
        c.style.height = `${sz}px`;
        c.style.imageRendering = sz <= 32 ? "pixelated" : "auto";
        c.style.background =
          state.bgMode === "transparent"
            ? "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 50% / 16px 16px"
            : "transparent";
        c.style.borderRadius = "4px";
        const label = document.createElement("div");
        label.textContent = `${sz}×${sz}`;
        label.style.fontSize = "11px";
        label.style.color = "#888";
        wrap.appendChild(c);
        wrap.appendChild(label);
        node.appendChild(wrap);
      });
    })();
    return () => {
      alive = false;
    };
  }, [opts, state.bgMode]);

  const uploadProps: UploadProps = {
    accept: "image/png,image/jpeg,image/svg+xml",
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        dispatch({ type: "patch", patch: { imageDataUrl: String(e.target?.result || "") } });
      reader.readAsDataURL(file);
      return false;
    },
  };

  async function handleDownload() {
    if (!opts) {
      message.warning("Pick a source first");
      return;
    }
    setBusy(true);
    try {
      const zip = new JSZip();

      const sizes = [16, 32, 48, 180, 192, 512];
      const blobs: Record<number, Blob> = {};
      for (const s of sizes) {
        const isApple = s === 180;
        const c = await renderIcon(s, { ...opts, forceOpaque: isApple });
        blobs[s] = await canvasToBlob(c);
      }

      // Maskable: 10% extra inner padding, opaque required
      const maskable = await renderIcon(512, { ...opts, forceOpaque: true, extraPaddingPct: 10 });
      const maskableBlob = await canvasToBlob(maskable);

      // ICO from 16/32/48
      const ico = await encodeIco([
        { size: 16, blob: blobs[16] },
        { size: 32, blob: blobs[32] },
        { size: 48, blob: blobs[48] },
      ]);

      zip.file("favicon.ico", ico);
      zip.file("favicon-16x16.png", blobs[16]);
      zip.file("favicon-32x32.png", blobs[32]);
      zip.file("apple-touch-icon.png", blobs[180]);
      zip.file("icon-192.png", blobs[192]);
      zip.file("icon-512.png", blobs[512]);
      zip.file("icon-512-maskable.png", maskableBlob);

      const manifest = {
        name: state.appName,
        short_name: state.appName,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        theme_color: state.bgMode === "transparent" ? "#ffffff" : state.bgColor,
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
      };
      zip.file("site.webmanifest", JSON.stringify(manifest, null, 2));
      zip.file("README.txt", `Drop these files at your site root, then add the snippet from the Icon Kit page to your <head>.\n`);

      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, "favicons.zip");
      message.success("Downloaded favicons.zip");
    } catch (e) {
      console.error(e);
      message.error("Something went wrong generating icons");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card size="small" title="1. Pick your mark">
        <Tabs
          activeKey={state.tab}
          onChange={(k) => dispatch({ type: "patch", patch: { tab: k as SourceTab } })}
          items={[
            {
              key: "initials",
              label: "Initials",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Input
                    maxLength={3}
                    value={state.initialsText}
                    onChange={(e) =>
                      dispatch({ type: "patch", patch: { initialsText: e.target.value.toUpperCase() } })
                    }
                    placeholder="1–3 letters"
                  />
                  <Space wrap>
                    <span>Text color</span>
                    <ColorPicker
                      value={state.initialsColor}
                      onChange={(c) =>
                        dispatch({ type: "patch", patch: { initialsColor: c.toHexString() } })
                      }
                    />
                  </Space>
                </Space>
              ),
            },
            {
              key: "emoji",
              label: "Emoji",
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Input
                    value={state.emoji}
                    maxLength={2}
                    onChange={(e) => dispatch({ type: "patch", patch: { emoji: e.target.value } })}
                    placeholder="Paste an emoji"
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                    {EMOJI_PICKS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => dispatch({ type: "patch", patch: { emoji: em } })}
                        style={{
                          background: state.emoji === em ? "#e6f0ee" : "transparent",
                          border: "1px solid #eee",
                          borderRadius: 6,
                          padding: 6,
                          fontSize: 20,
                          cursor: "pointer",
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </Space>
              ),
            },
            {
              key: "image",
              label: "Upload",
              children: (
                <Upload.Dragger {...uploadProps} style={{ padding: 8 }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Drop a PNG / JPG / SVG</p>
                  <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                    Square images work best.
                  </p>
                  {state.imageDataUrl && (
                    <p style={{ marginTop: 8, fontSize: 12, color: "#2f4f46" }}>✓ Image loaded</p>
                  )}
                </Upload.Dragger>
              ),
            },
          ]}
        />
      </Card>

      <Card size="small" title="2. Background & shape">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Radio.Group
            value={state.bgMode}
            onChange={(e) => dispatch({ type: "patch", patch: { bgMode: e.target.value } })}
          >
            <Radio.Button value="transparent">Transparent</Radio.Button>
            <Radio.Button value="solid">Solid</Radio.Button>
            <Radio.Button value="tile">Rounded tile</Radio.Button>
          </Radio.Group>
          {state.bgMode !== "transparent" && (
            <Space>
              <span>Background</span>
              <ColorPicker
                value={state.bgColor}
                onChange={(c) => dispatch({ type: "patch", patch: { bgColor: c.toHexString() } })}
              />
            </Space>
          )}
          <div>
            <Typography.Text type="secondary">Padding (safe area) — {state.paddingPct}%</Typography.Text>
            <Slider
              min={0}
              max={30}
              value={state.paddingPct}
              onChange={(v) => dispatch({ type: "patch", patch: { paddingPct: v as number } })}
            />
          </div>
          <div>
            <Typography.Text type="secondary">Corner radius — {state.radiusPct}% {state.radiusPct >= 50 ? "(circle)" : ""}</Typography.Text>
            <Slider
              min={0}
              max={50}
              value={state.radiusPct}
              onChange={(v) => dispatch({ type: "patch", patch: { radiusPct: v as number } })}
              disabled={state.bgMode !== "tile"}
            />
          </div>
        </Space>
      </Card>

      <Card size="small" title="Preview">
        <div
          ref={previewRef}
          style={{ display: "flex", gap: 24, alignItems: "flex-end", flexWrap: "wrap" }}
        />
      </Card>

      <Card size="small" title="3. Download">
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Input
            addonBefore="App name"
            value={state.appName}
            onChange={(e) => dispatch({ type: "patch", patch: { appName: e.target.value } })}
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="large"
            loading={busy}
            onClick={handleDownload}
            block
          >
            Download favicons.zip
          </Button>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
            Includes .ico (16/32/48), 16/32/180/192/512 PNGs, a maskable icon, and a pre-filled site.webmanifest.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card size="small" title="<head> snippet">
        <Typography.Paragraph
          copyable={{ text: htmlSnippet() }}
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
          {htmlSnippet()}
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}