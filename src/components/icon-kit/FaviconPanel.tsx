import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  ColorPicker,
  Input,
  Modal,
  Radio,
  Slider,
  Space,
  Tabs,
  Typography,
  Upload,
  App,
} from "antd";
import { DownloadOutlined, FolderOpenOutlined, InboxOutlined, ScissorOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import JSZip from "jszip";

import {
  buildSvg,
  canvasToBlob,
  renderIcon,
  type BgMode,
  type IconOpts,
  type SourceSpec,
} from "../../lib/icon-kit/canvas";
import { encodeIco } from "../../lib/icon-kit/ico";
import { downloadBlob, blobToDataUrl } from "../../lib/icon-kit/download";
import { fromSocialKitJson, configForTab, type SocialAsset, type SocialConfig } from "../../lib/icon-kit/brand-kit";
import { usePersistentReducer } from "../../hooks/use-persistent-reducer";
import { ExportToBoardButton } from "./ExportToBoardButton";
import { ImageCropper } from "./ImageCropper";
import type { CropRect } from "../../lib/icon-kit/crop";

type SourceTab = "image" | "initials" | "emoji";

export interface FaviconState {
  tab: SourceTab;
  imageDataUrl: string | null;
  /** The uncropped upload, kept so the crop is non-destructive and re-editable.
   *  imageDataUrl holds the CROPPED result the pipeline actually renders. */
  originalImageDataUrl: string | null;
  /** Fractional crop applied to originalImageDataUrl (null = whole image). */
  cropRect: CropRect | null;
  initialsText: string;
  initialsColor: string;
  emoji: string;
  bgMode: BgMode;
  bgColor: string;
  paddingPct: number;
  radiusPct: number;
  appName: string;
}
// Local alias so the rest of this file reads unchanged.
type State = FaviconState;

// Signature of a favicon recipe — used to claim a legacy flat `config` for this
// tab (and reject a social config that lacks these keys).
export function looksLikeFavicon(c: SocialConfig): boolean {
  return "tab" in c && ("initialsText" in c || "emoji" in c || "imageDataUrl" in c);
}

export const FAVICON_KEY = "iconkit.favicon.v1";
export const faviconInitial: State = {
  tab: "initials",
  imageDataUrl: null,
  originalImageDataUrl: null,
  cropRect: null,
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

// Build the three client-facing icons Brand Board shows for a favicon set: the
// 512 app-icon master, the 180 apple-touch icon (forced opaque so no transparent
// checkerboard), and the 32 favicon (the literal browser-tab deliverable). We
// deliberately DON'T ship every generated size (16/48/192/maskable/SVG would read
// as near-identical clutter on a showcase board). Returns [] if no source yet.
export async function buildFaviconAssets(s: State): Promise<SocialAsset[]> {
  const source = buildSource(s);
  if (!source) return [];
  const opts: IconOpts = {
    source,
    bgMode: s.bgMode,
    bgColor: s.bgColor,
    paddingPct: s.paddingPct,
    radiusPct: s.radiusPct,
  };
  const specs: { size: number; opaque: boolean; label: string; kind: string }[] = [
    { size: 512, opaque: false, label: "App icon", kind: "icon" },
    { size: 180, opaque: true, label: "Apple touch icon", kind: "icon" },
    { size: 32, opaque: false, label: "Favicon", kind: "favicon" },
  ];
  const assets: SocialAsset[] = [];
  for (const spec of specs) {
    const canvas = await renderIcon(spec.size, { ...opts, forceOpaque: spec.opaque });
    const blob = await canvasToBlob(canvas);
    const image = await blobToDataUrl(blob);
    assets.push({ image, label: spec.label, kind: spec.kind, width: spec.size, height: spec.size });
  }
  return assets;
}

// Has the user actually touched this tab, or is it still the stock placeholder?
// A brand kit must never carry the default "OP" green tile into a client's board
// just because the tab exists. Compared field-by-field against the initial state.
export function faviconIsDirty(s: State): boolean {
  const k: (keyof State)[] = [
    "tab",
    "imageDataUrl",
    "originalImageDataUrl",
    "initialsText",
    "initialsColor",
    "emoji",
    "bgMode",
    "bgColor",
    "paddingPct",
    "radiusPct",
    "appName",
  ];
  return k.some((key) => s[key] !== faviconInitial[key]);
}

function buildSource(s: State): SourceSpec | null {
  if (s.tab === "image") {
    return s.imageDataUrl ? { type: "image", dataUrl: s.imageDataUrl } : null;
  }
  if (s.tab === "initials") {
    return { type: "initials", text: s.initialsText || "?", color: s.initialsColor };
  }
  return { type: "emoji", char: s.emoji || "★" };
}

// Relative paths (./) so the icons resolve whether the site is served from the
// root or a subpath (GitHub Pages project sites, etc.). Absolute "/" paths
// silently 404 under a subpath.
function htmlSnippet(themeColor: string) {
  return `<link rel="icon" type="image/svg+xml" href="./favicon.svg">
<link rel="icon" href="./favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="./favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="./favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png">
<link rel="manifest" href="./site.webmanifest">
<meta name="theme-color" content="${themeColor}">`;
}

export function FaviconPanel() {
  const [state, dispatch] = usePersistentReducer(FAVICON_KEY, reducer, faviconInitial);
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenText, setReopenText] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const source = useMemo(() => buildSource(state), [state]);

  // Theme color follows the chosen background; transparent has no meaningful
  // theme color so we fall back to white.
  const themeColor = state.bgMode === "transparent" ? "#ffffff" : state.bgColor;

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
        c.style.imageRendering = "auto";
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
      reader.onload = (e) => {
        const url = String(e.target?.result || "");
        // Store the untouched upload as BOTH the original and the working image
        // (uncropped to start), reset any prior crop, then open the cropper so
        // the user can immediately frame the badge. Most logos need a crop, so
        // opening it is the helpful default — they can cancel to keep the whole
        // image.
        dispatch({
          type: "patch",
          patch: { originalImageDataUrl: url, imageDataUrl: url, cropRect: null },
        });
        setCropOpen(true);
      };
      reader.readAsDataURL(file);
      return false;
    },
  };

  function applyCrop({ croppedDataUrl, rect }: { croppedDataUrl: string; rect: CropRect }) {
    dispatch({ type: "patch", patch: { imageDataUrl: croppedDataUrl, cropRect: rect } });
    setCropOpen(false);
  }

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

      zip.file("favicon.svg", buildSvg(opts));
      zip.file("favicon.ico", ico);
      zip.file("favicon-16x16.png", blobs[16]);
      zip.file("favicon-32x32.png", blobs[32]);
      zip.file("apple-touch-icon.png", blobs[180]);
      zip.file("icon-192.png", blobs[192]);
      zip.file("icon-512.png", blobs[512]);
      zip.file("icon-512-maskable.png", maskableBlob);

      // Relative icon paths so the manifest works under a subpath too.
      const manifest = {
        name: state.appName,
        short_name: state.appName,
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        theme_color: themeColor,
        background_color: "#ffffff",
        display: "standalone",
        start_url: ".",
      };
      zip.file("site.webmanifest", JSON.stringify(manifest, null, 2));
      zip.file(
        "README.txt",
        [
          "Place these files next to your index.html (or at your site root), then",
          "paste the <head> snippet from the Icon Kit page into your HTML.",
          "",
          "The links use relative paths (./) so they work whether your site is",
          "served from the root or a subpath.",
          "",
          "Files:",
          "  favicon.svg            scalable, modern browsers prefer this",
          "  favicon.ico            16/32/48 — classic browser tabs",
          "  favicon-16x16.png      ",
          "  favicon-32x32.png      ",
          "  apple-touch-icon.png   180px — iOS home screen",
          "  icon-192.png           PWA",
          "  icon-512.png           PWA",
          "  icon-512-maskable.png  PWA adaptive icon (Android)",
          "  site.webmanifest       PWA manifest",
          "",
        ].join("\n"),
      );

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

  // Reopen: paste a previously exported favicon blob to restore the mark. Strict on
  // the envelope; if the blob predates the `config` field, say so rather than
  // silently doing nothing. (Shares the social panel's blob shape — a social-banner
  // blob has a `config` too, but its fields don't overlap the favicon State, so the
  // patch just no-ops on the wrong shape. The common real case is reopening a blob
  // that came from THIS tab.)
  function reopenFromBlob(raw: string): boolean {
    const parsed = fromSocialKitJson(raw);
    if (!parsed) {
      message.error("That doesn't look like an Icon Kit export.");
      return false;
    }
    // Pull THIS tab's recipe (new per-tab shape), falling back to a legacy flat
    // config only if it looks like favicon state.
    const config = configForTab(parsed, "favicon", looksLikeFavicon);
    if (!config) {
      const hasSocial = Boolean(parsed.data.configs?.social);
      message.warning(
        hasSocial
          ? "This blob only has the Social & Banners design — switch to that tab and Reopen there."
          : "This blob has the images but no saved favicon settings. Re-export from a current design to reopen it losslessly.",
      );
      return false;
    }
    // Only restore keys this panel actually owns — so a stray field can't inject
    // into favicon state. Building the patch key-by-key also keeps types honest.
    const c = config as Partial<State>;
    const patch: Partial<State> = {};
    if (c.tab !== undefined) patch.tab = c.tab;
    if (c.imageDataUrl !== undefined) patch.imageDataUrl = c.imageDataUrl;
    if (c.originalImageDataUrl !== undefined) patch.originalImageDataUrl = c.originalImageDataUrl;
    if (c.cropRect !== undefined) patch.cropRect = c.cropRect;
    if (c.initialsText !== undefined) patch.initialsText = c.initialsText;
    if (c.initialsColor !== undefined) patch.initialsColor = c.initialsColor;
    if (c.emoji !== undefined) patch.emoji = c.emoji;
    if (c.bgMode !== undefined) patch.bgMode = c.bgMode;
    if (c.bgColor !== undefined) patch.bgColor = c.bgColor;
    if (c.paddingPct !== undefined) patch.paddingPct = c.paddingPct;
    if (c.radiusPct !== undefined) patch.radiusPct = c.radiusPct;
    if (c.appName !== undefined) patch.appName = c.appName;
    if (Object.keys(patch).length === 0) {
      message.error("That export doesn't hold favicon settings — reopen it in its own tool.");
      return false;
    }
    dispatch({ type: "patch", patch });
    message.success("Icon reopened — every control is restored.");
    return true;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13, flex: 1, minWidth: 220 }}>
          Build a favicon and app-icon set — download the full pack, or send the
          key icons to Brand Board for a client's kit.
        </Typography.Paragraph>
        <Button icon={<FolderOpenOutlined />} onClick={() => setReopenOpen(true)}>
          Reopen a saved icon
        </Button>
      </div>

      <Modal
        title="Reopen a saved icon"
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
          Paste an <b>Export to Brand Board</b> blob (from this Favicon tab) to
          rebuild the mark — source, background, shape, padding and app name. It's
          the same blob you'd paste into Brand Board.
        </Typography.Paragraph>
        <Input.TextArea
          rows={6}
          value={reopenText}
          onChange={(e) => setReopenText(e.target.value)}
          placeholder='{"type":"social","v":1,"source":"opsette","data":{...}}'
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
        />
      </Modal>

      {state.originalImageDataUrl && (
        <ImageCropper
          open={cropOpen}
          imageDataUrl={state.originalImageDataUrl}
          initialRect={state.cropRect}
          onCancel={() => setCropOpen(false)}
          onApply={applyCrop}
        />
      )}

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
                <Space direction="vertical" style={{ width: "100%" }} size={10}>
                  <Upload.Dragger {...uploadProps} style={{ padding: 8 }}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">Drop a PNG / JPG / SVG</p>
                    <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                      Any shape works — crop it to a square next.
                    </p>
                    {state.imageDataUrl && (
                      <p style={{ marginTop: 8, fontSize: 12, color: "#2f4f46" }}>✓ Image loaded</p>
                    )}
                  </Upload.Dragger>
                  {state.originalImageDataUrl && (
                    <Button
                      icon={<ScissorOutlined />}
                      onClick={() => setCropOpen(true)}
                      block
                    >
                      {state.cropRect ? "Re-crop image" : "Crop image"}
                    </Button>
                  )}
                </Space>
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
            Includes a scalable favicon.svg, .ico (16/32/48), 16/32/180/192/512 PNGs, a maskable icon, and a pre-filled site.webmanifest.
          </Typography.Paragraph>
          <ExportToBoardButton scope="favicon" liveState={state} disabled={!opts} block />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
            Sends the app-icon (512), Apple touch icon (180) and favicon (32) as a
            brand-asset set — paste into Brand Board, or back into “Reopen” to revise.
            If you've also designed a social banner, you'll be offered to export both.
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card size="small" title="<head> snippet">
        <Typography.Paragraph
          copyable={{ text: htmlSnippet(themeColor) }}
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
          {htmlSnippet(themeColor)}
        </Typography.Paragraph>
      </Card>
    </Space>
  );
}