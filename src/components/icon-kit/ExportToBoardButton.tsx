import { useState } from "react";
import { App, Button, Popover, Space, Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";

import {
  buildCombinedExport,
  otherTabIsDirty,
  type ExportScope,
} from "../../lib/icon-kit/export-assets";
import type { SocialState } from "./SocialPanel";
import type { FaviconState } from "./FaviconPanel";

const TAB_LABEL: Record<"social" | "favicon", string> = {
  social: "Social & Banners",
  favicon: "Favicon",
};

// One export control, shared by both tabs. It writes ONE blob to the clipboard —
// Brand Board's single social slot takes the whole thing. A popover lets the user
// pick "just this tab" or "both tabs"; "both" only appears when the OTHER tab has
// real (non-placeholder) work, so a stock default never rides into a client's kit.
export function ExportToBoardButton({
  scope,
  liveState,
  disabled,
  block,
}: {
  scope: "social" | "favicon";
  liveState: SocialState | FaviconState;
  disabled?: boolean;
  block?: boolean;
}) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const otherDirty = otherTabIsDirty(scope);
  const otherLabel = TAB_LABEL[scope === "social" ? "favicon" : "social"];

  async function run(exportScope: ExportScope) {
    setOpen(false);
    setBusy(true);
    try {
      const { json, assetCount } = await buildCombinedExport(exportScope, scope, liveState);
      if (assetCount === 0) {
        message.info(
          scope === "social"
            ? "Select at least one size to export"
            : "Pick a source first",
        );
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

  // Nothing to combine → a plain button that exports just this tab.
  if (!otherDirty) {
    return (
      <Button
        icon={<ExportOutlined />}
        size="large"
        loading={busy}
        disabled={disabled}
        block={block}
        onClick={() => run(scope)}
      >
        Export to Brand Board
      </Button>
    );
  }

  const content = (
    <Space direction="vertical" size={4} style={{ maxWidth: 260 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        You've designed both tabs — export just this one, or bundle both into a
        single paste for Brand Board.
      </Typography.Text>
      <Button block onClick={() => run(scope)}>
        Export this tab ({TAB_LABEL[scope]})
      </Button>
      <Button block type="primary" onClick={() => run("both")}>
        Export both (+ {otherLabel})
      </Button>
    </Space>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="top"
      content={content}
      title="Export to Brand Board"
    >
      <Button icon={<ExportOutlined />} size="large" loading={busy} disabled={disabled} block={block}>
        Export to Brand Board
      </Button>
    </Popover>
  );
}
