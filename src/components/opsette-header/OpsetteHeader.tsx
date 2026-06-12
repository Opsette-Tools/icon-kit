import React from "react";
import { ShareAppButton } from "@/components/opsette-share";
import { opsetteHeaderConfig } from "./config";
import "./header.css";

/**
 * OpsetteHeader — the canonical unified header for every Opsette tool.
 *
 * Renders a sticky 60px three-region bar:
 *   [Opsette mark]  [tool name]                   [share + extras]
 *
 * The component is framework-free in its rendered DOM (plain <header>, scoped
 * .ops-header-* classes) so it produces identical output in shadcn apps and
 * AntD apps. AntD apps wrap this in <Layout>...<Content> as usual; the header
 * itself does not depend on AntD.
 *
 * Spec: c:\Opsette Tools\HEADER_BAR.md
 */

interface OpsetteHeaderProps {
  /**
   * Override the tool name from config. Optional — defaults to
   * `opsetteHeaderConfig.toolName`. Useful for tools that programmatically
   * adjust the displayed name (rare).
   */
  toolName?: string;
  /**
   * Slot for any tool-specific controls (dark-mode toggle, settings menu,
   * etc.) that should sit to the right of the share button. The share button
   * itself is always rendered by OpsetteHeader — do not pass it here.
   */
  rightExtra?: React.ReactNode;
  /**
   * Visual theme. Sets `data-theme` on the <header> so the .ops-header
   * dark-mode rules apply. Default is "light".
   */
  theme?: "light" | "dark";
  /**
   * Optional className for callers that need to add tool-specific overrides.
   * The canonical .ops-header class is always applied.
   */
  className?: string;
  /**
   * Optional override for the share-button size. Defaults to undefined which
   * uses ShareAppButton's own default (36).
   */
  shareSize?: number;
}

export const OpsetteHeader: React.FC<OpsetteHeaderProps> = ({
  toolName,
  rightExtra,
  theme = "light",
  className,
  shareSize,
}) => {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const name = toolName ?? opsetteHeaderConfig.toolName;
  const headerClass = className ? `ops-header ${className}` : "ops-header";

  return (
    <header className={headerClass} data-theme={theme}>
      <a
        className="ops-header-mark"
        href="https://tools.opsette.io"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Opsette Tools"
      >
        <img
          src={`${base}opsette-logo.png`}
          alt="Opsette Tools"
          width={40}
          height={40}
        />
      </a>

      <div className="ops-header-title">
        <h1 className="ops-header-name">{name}</h1>
      </div>

      <div className="ops-header-actions">
        <ShareAppButton {...(shareSize !== undefined ? { size: shareSize } : {})} />
        {rightExtra}
      </div>
    </header>
  );
};

export default OpsetteHeader;
