import { useState } from "react";
import { ConfigProvider, App as AntdApp, Segmented, Typography } from "antd";
import { OpsetteHeader } from "./components/opsette-header";
import { OpsetteFooterLogo } from "./components/opsette-share";
import { FaviconPanel } from "./components/icon-kit/FaviconPanel";
import { SocialPanel } from "./components/icon-kit/SocialPanel";
import { readSeedFromUrl, clearLinkParams } from "./lib/opsette-kit-link";
import { applyIconKitSeed } from "./lib/seed";

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

export default function App() {
  // Lazy init runs consumeSeed exactly once, on first render, before either
  // panel mounts and hydrates from localStorage.
  const [seeded] = useState(consumeSeed);
  const [tab, setTab] = useState<"favicon" | "social">(seeded ? "social" : "favicon");

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
        <div style={{ minHeight: "100dvh", background: "#fafafa" }}>
          <OpsetteHeader />

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
            {tab === "favicon" ? <FaviconPanel /> : <SocialPanel />}
            <Typography.Paragraph
              type="secondary"
              style={{ textAlign: "center", fontSize: 12, marginTop: 32 }}
            >
              Runs entirely in your browser. Nothing is uploaded.
            </Typography.Paragraph>

            <OpsetteFooterLogo />
          </main>
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
