import React from "react";
import { opsetteShareConfig } from "./config";
import "./share.css";

const resolveAsset = (src?: string): string | undefined => {
  if (!src) return undefined;
  if (/^(https?:|data:)/i.test(src)) return src;
  // Vite injects BASE_URL ("/" in dev, "/<app>/" in prod). Strip leading slashes
  // from the asset name so we never produce "//file.png".
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/+$/, "/")}${src.replace(/^\/+/, "")}`;
};

const OpsetteFooterLogo: React.FC = () => {
  const { logoSrc } = opsetteShareConfig;
  const resolvedSrc = resolveAsset(logoSrc);
  return (
    <div className="ops-footer-logo">
      <a href="https://opsette.io" target="_blank" rel="noopener noreferrer" className="ops-footer-logo-link" aria-label="Opsette home">
        {resolvedSrc ? <img src={resolvedSrc} alt="Opsette" className="ops-footer-logo-img" /> : <span className="ops-footer-logo-text">Opsette</span>}
      </a>
      <div className="ops-footer-logo-links">
        <a href="https://opsette.io" target="_blank" rel="noopener noreferrer">opsette.io</a>
        <span className="ops-footer-dot">·</span>
        <a href="https://tools.opsette.io" target="_blank" rel="noopener noreferrer">More free tools</a>
      </div>
    </div>
  );
};

export default OpsetteFooterLogo;
