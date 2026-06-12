import React, { useState } from "react";
import ShareAppModal from "./ShareAppModal";
import "./share.css";

type Props = {
  size?: number;
  ariaLabel?: string;
};

const ShareAppButton: React.FC<Props> = ({ size = 36, ariaLabel = "Share this app" }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="ops-share-trigger"
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        style={{ width: size, height: size }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>
      <ShareAppModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default ShareAppButton;
