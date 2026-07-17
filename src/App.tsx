import { useEffect, useMemo, useState } from "react";
import { ConfigProvider, App as AntdApp, Segmented, Typography } from "antd";
import { OpsetteHeader } from "./components/opsette-header";
import { OpsetteFooterLogo } from "./components/opsette-share";
import { EmbedSaveBar } from "./components/EmbedSaveBar";
import { FaviconPanel } from "./components/icon-kit/FaviconPanel";
import { SocialPanel } from "./components/icon-kit/SocialPanel";
import {
  readSeedFromUrl,
  clearLinkParams,
  isEmbedded,
  isTrustedEmbedMessage,
  embedSave,
  OPSETTE_TOOLS_ORIGIN,
} from "./lib/opsette-kit-link";
import { applyIconKitSeed, applyEmbedBlob } from "./lib/seed";
import {
  buildCombinedExport,
  readSocialState,
  readFaviconState,
} from "./lib/icon-kit/export-assets";

// Apply a ?seed= brand core (Mechanism 1) ONCE, synchronously, before the panels
// mount — it's merged into both panels' localStorage so they hydrate branded.
// Returns whether a seed landed, so the default tab can jump to Social (the
// banner is the thing you want to see branded first). Cleared from the URL after.
function consumeSeed(): boolean {
  const core = readSeedFromUrl();
  if (!core) return false;
  applyIconKitSeed(core);
  clearLinkParams();
  return true;
}

function IconKitInner() {
  // Lazy init runs consumeSeed exactly once, on first render, before either
  // panel mounts and hydrates from localStorage.
  const [seeded] = useState(consumeSeed);
  const [tab, setTab] = useState<"favicon" | "social">(seeded ? "social" : "favicon");
  const { message } = AntdApp.useApp();

  // ── Mechanism 3: running inside a Brand Board iframe ──────────────────────
  const embedded = useMemo(() => isEmbedded(), []);
  const trustedParentOrigins = useMemo(
    () => (import.meta.env.DEV ? [window.location.origin, "http://localhost:8124"] : []),
    [],
  );
  const [saving, setSaving] = useState(false);
  // Bumped after an embed `load` merges the incoming blob into localStorage; it
  // keys the panels so they REMOUNT and re-hydrate from the merged storage (the
  // load arrives after the panels have already mounted, so a remount is how they
  // pick up the client's assets — mirrors the seed's pre-mount merge trick).
  const [loadNonce, setLoadNonce] = useState(0);

  // Inbound: the parent hands us the current Icon Kit blob to revise. Merge its
  // tab configs into localStorage (reusing the reopen recipe), switch to the tab
  // it carried, and remount the panels so they hydrate branded. Origin-checked.
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedEmbedMessage(event, trustedParentOrigins)) return;
      if (event.data.kind === "load" && typeof event.data.payload === "string") {
        const target = applyEmbedBlob(event.data.payload);
        if (target) {
          setTab(target);
          setLoadNonce((n) => n + 1);
        }
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ source: "opsette-embed", kind: "ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [embedded, trustedParentOrigins]);

  // Outbound: build the SAME "both"-scope blob "Export to Brand Board" produces
  // (baked PNGs + per-tab reopen configs), reading the live tab's state from
  // localStorage (the panels persist on every change), and post it up.
  const saveToBrandBoard = async () => {
    setSaving(true);
    try {
      const liveState = tab === "social" ? readSocialState() : readFaviconState();
      const { json, assetCount } = await buildCombinedExport("both", tab, liveState);
      if (assetCount === 0) {
        message.warning("Nothing to send yet — add a banner or favicon first.");
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
          // Social builder uses a wide two-column layout (controls + sticky
          // previews); the favicon tool is a single narrow column.
          maxWidth: tab === "social" ? 1240 : 720,
          margin: "0 auto",
          padding: "16px",
          transition: "max-width 0.2s ease",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Segmented
            block
            size="large"
            value={tab}
            onChange={(v) => setTab(v as "favicon" | "social")}
            options={[
              { label: "Favicon", value: "favicon" },
              { label: "Social & Banners", value: "social" },
            ]}
            style={{ marginBottom: 16, width: "100%" }}
          />
        </div>
        {tab === "favicon" ? (
          <FaviconPanel key={`favicon-${loadNonce}`} />
        ) : (
          <SocialPanel key={`social-${loadNonce}`} />
        )}
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
      }}
    >
      <AntdApp>
        <IconKitInner />
      </AntdApp>
    </ConfigProvider>
  );
}
