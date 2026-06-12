import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Segmented } from "antd";

import { FaviconPanel } from "../components/icon-kit/FaviconPanel";
import { SocialPanel } from "../components/icon-kit/SocialPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Icon Kit — Favicons & social images" },
      { name: "description", content: "Generate favicons, app icons, and Open Graph social images in your browser. Part of Opsette Tools." },
      { property: "og:title", content: "Icon Kit" },
      { property: "og:description", content: "Generate favicons and social images right in your browser." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState<"favicon" | "social">("favicon");
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "saturate(180%) blur(8px)",
          borderBottom: "1px solid #ececec",
          padding: "12px 16px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "#2f4f46",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            IK
          </div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#1f2a27" }}>Icon Kit</h1>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>Opsette Tools</span>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px" }}>
        <Segmented
          block
          size="large"
          value={tab}
          onChange={(v) => setTab(v as "favicon" | "social")}
          options={[
            { label: "Favicon", value: "favicon" },
            { label: "Social Image", value: "social" },
          ]}
          style={{ marginBottom: 16 }}
        />
        {tab === "favicon" ? <FaviconPanel /> : <SocialPanel />}
        <p style={{ textAlign: "center", color: "#999", fontSize: 12, marginTop: 32 }}>
          Runs entirely in your browser. Nothing is uploaded.
        </p>
      </main>
    </div>
  );
}
