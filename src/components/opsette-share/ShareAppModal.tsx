import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { opsetteShareConfig } from "./config";
import "./share.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ShareAppModal: React.FC<Props> = ({ open, onClose }) => {
  const { appName, tagline, url } = opsetteShareConfig;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 1,
      color: { dark: "#2f4f46", light: "#ffffff" },
    }).catch(() => {});
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — fall back to selecting the input
    }
  };

  const handleShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: appName, text: tagline, url });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // Portal to document.body so the modal escapes any ancestor with transform,
  // filter, backdrop-filter, etc. (those break position: fixed for descendants).
  return createPortal(
    <div className="ops-share-overlay" role="dialog" aria-modal="true" aria-label={`Share ${appName}`} onClick={onClose}>
      <div className="ops-share-modal" onClick={(e) => e.stopPropagation()}>
        <button className="ops-share-close" aria-label="Close" onClick={onClose}>×</button>

        <div className="ops-share-head">
          <div className="ops-share-eyebrow">Share this app</div>
          <h2 className="ops-share-title">{appName}</h2>
          <p className="ops-share-tagline">{tagline}</p>
        </div>

        <div className="ops-share-qr-wrap">
          <canvas ref={canvasRef} className="ops-share-qr" />
        </div>

        <div className="ops-share-url-row">
          <input className="ops-share-url" value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
          <button className="ops-share-btn ops-share-btn-secondary" onClick={handleCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button className="ops-share-btn ops-share-btn-primary" onClick={handleShare}>
          {canNativeShare ? "Share…" : "Copy link"}
        </button>

        <p className="ops-share-note">No data is shared — just the app link.</p>
      </div>
    </div>,
    document.body,
  );
};

export default ShareAppModal;
