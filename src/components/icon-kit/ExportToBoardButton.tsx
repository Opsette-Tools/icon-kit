import { useState } from "react";
import { App, Button } from "antd";
import { ExportOutlined } from "@ant-design/icons";

import { buildFaviconExport } from "../../lib/icon-kit/export-assets";
import type { FaviconState } from "./FaviconPanel";

// The one export control on the Favicon tool. It writes ONE `type:"social"` blob
// (the frozen Brand Board kit shape) carrying the favicon set. Brand Board's slot
// takes the whole thing; the same blob also pastes back into "Reopen" to revise.
// (Icon Kit used to also export banners here — that's Banner Designer's job now,
// so this is favicon-only.)
export function ExportToBoardButton({
  liveState,
  disabled,
  block,
}: {
  liveState: FaviconState;
  disabled?: boolean;
  block?: boolean;
}) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const { json, assetCount } = await buildFaviconExport(liveState);
      if (assetCount === 0) {
        message.info("Pick a source first");
        return;
      }
      await navigator.clipboard.writeText(json);
      message.success(
        `Copied ${assetCount} asset(s) — paste into Brand Board, or back into “Reopen” to revise later`,
      );
    } catch (e) {
      console.error(e);
      message.error("Could not export to Brand Board");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      icon={<ExportOutlined />}
      size="large"
      loading={busy}
      disabled={disabled}
      block={block}
      onClick={() => void run()}
    >
      Export to Brand Board
    </Button>
  );
}
