import { useEffect, useMemo, useState } from "react";
import { ConfigProvider, App as AntdApp, Typography } from "antd";
import { OpsetteHeader } from "./components/opsette-header";
import { OpsetteFooterLogo } from "./components/opsette-share";
import { EmbedSaveBar } from "./components/EmbedSaveBar";
import { FaviconPanel } from "./components/icon-kit/FaviconPanel";
import {
  readSeedFromUrl,
  clearLinkParams,
  isEmbedded,
  isTrustedEmbedMessage,
  embedSave,
  OPSETTE_TOOLS_ORIGIN,
} from "./lib/opsette-kit-link";
import { applyIconKitSeed, applyEmbedBlob } from "./lib/seed";
import { buildFaviconExport, readFaviconState } from "./lib/icon-kit/export-assets";

// Apply a ?seed= brand core (Mechanism 1) ONCE, synchronously, before the panel
// mounts — it's merged into the panel's localStorage so it hydrates branded.
// Cleared from the URL after.
function consumeSeed(): void {
  const core = readSeedFromUrl();
  if (!core) return;
  applyIconKitSeed(core);
  clearLinkParams();
}

function IconKitInner() {
  // Lazy init runs consumeSeed exactly once, on first render, before the panel
  // mounts and hydrates from localStorage.
  useState(() => {
    consumeSeed();
    return null;
  });
  const { message } = AntdApp.useApp();

  // ── Mechanism 3: running inside a Brand Board iframe ──────────────────────
  const embedded = useMemo(() => isEmbedded(), []);
  const trustedParentOrigins = useMemo(
    () => (import.meta.env.DEV ? [window.location.origin, "http://localhost:8124"] : []),
    [],
  );
  const [saving, setSaving] = useState(false);
  // Bumped after an embed `load` merges the incoming blob into localStorage; it
  // keys the panel so it REMOUNTS and re-hydrates from the merged storage (the
  // load arrives after the panel has already mounted, so a remount is how it
  // picks up the client's assets — mirrors the seed's pre-mount merge trick).
  const [loadNonce, setLoadNonce] = useState(0);

  // Inbound: the parent hands us the current Icon Kit blob to revise. Merge its
  // favicon config into localStorage (reusing the reopen recipe) and remount the
  // panel so it hydrates branded. Origin-checked.
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedEmbedMessage(event, trustedParentOrigins)) return;
      if (event.data.kind === "load" && typeof event.data.payload === "string") {
        if (applyEmbedBlob(event.data.payload)) {
          setLoadNonce((n) => n + 1);
        }
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ source: "opsette-embed", kind: "ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [embedded, trustedParentOrigins]);

  // Outbound: build the favicon blob "Export to Brand Board" produces (baked PNGs
  // + reopen config), reading the live state from localStorage (the panel
  // persists on every change), and post it up.
  const saveToBrandBoard = async () => {
    setSaving(true);
    try {
      const { json, assetCount } = await buildFaviconExport(readFaviconState());
      if (assetCount === 0) {
        message.warning("Nothing to send yet — add a favicon first.");
        return;
      }
      const targetOrigin = import.meta.env.DEV ? "*" : OPSETTE_TOOLS_ORIGIN;
      window.parent.postMessage(embedSave(json), targetOrigin);
      message.success("Updated in Brand Board");
    } catch {
      message.error("Couldn't send the assets back — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#fafafa" }}>
      {embedded ? (
        <EmbedSaveBar onSave={() => void saveToBrandBoard()} saving={saving} />
      ) : (
        <OpsetteHeader />
      )}

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "16px",
        }}
      >
        <FaviconPanel key={`favicon-${loadNonce}`} />
        {!embedded && (
          <>
            <Typography.Paragraph
              type="secondary"
              style={{ textAlign: "center", fontSize: 12, marginTop: 32 }}
            >
              Runs entirely in your browser. Nothing is uploaded.
            </Typography.Paragraph>

            <OpsetteFooterLogo />
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2f4f46",
          fontFamily: '"Inter", system-ui, sans-serif',
          borderRadius: 10,
        },
        components: {
          // AntD derives the Select's selected/hover row background from
          // colorPrimary. With our dark-green primary that lands as a heavy,
          // muddy grey-green on the open dropdown. Override with a LIGHT tertiary
          // tint of the brand so the highlighted option reads as a soft wash, not
          // a dark block. (Known AntD gotcha — the default is far too dark for a
          // dark primary.)
          Select: {
            optionSelectedBg: "#e8f2ec", // selected row — pale brand tint
            optionSelectedColor: "#1c332c", // keep text legible on the pale tint
            controlItemBgHover: "#f0f6f3", // hover row — even lighter
          },
        },
      }}
    >
      <AntdApp>
        <IconKitInner />
      </AntdApp>
    </ConfigProvider>
  );
}
