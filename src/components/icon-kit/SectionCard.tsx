import { useState, type ReactNode } from "react";
import { Button, Card, Space, Tooltip, Typography } from "antd";
import { CaretRightOutlined, ReloadOutlined } from "@ant-design/icons";

// A numbered builder section. One shared primitive so every section in the Icon
// Kit reads the same: a tinted, accent-edged header (so groups are visually
// distinct), an optional collapse toggle, and an optional per-section reset.
//
// Styling lives in styles.css (.ops-section-card) — this component only wires the
// behavior, never hardcodes the look.
export function SectionCard({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  onReset,
  resetTip = "Reset this section",
  primary = false,
  extra,
}: {
  title: ReactNode;
  children: ReactNode;
  /** Fold the body away behind a header click. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Show a reset button in the header; omit to hide it. */
  onReset?: () => void;
  resetTip?: string;
  /** Stronger edge for the "primary" panel (e.g. the live previews). */
  primary?: boolean;
  /** Extra header controls, shown left of the reset/chevron. */
  extra?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => collapsible && setOpen((o) => !o);

  // The title spans the header's clickable area so the whole band (minus the
  // extra controls) toggles the collapse. The extra controls stopPropagation so
  // reset / select-all never accidentally fold the section.
  const headTitle = (
    <div
      onClick={toggle}
      style={{ cursor: collapsible ? "pointer" : "default", userSelect: "none" }}
    >
      <Typography.Text>{title}</Typography.Text>
    </div>
  );

  const headExtra = (
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      {extra}
      {onReset && (
        <Tooltip title={resetTip}>
          <Button
            size="small"
            type="text"
            icon={<ReloadOutlined />}
            onClick={onReset}
            aria-label={typeof resetTip === "string" ? resetTip : "Reset section"}
          />
        </Tooltip>
      )}
      {collapsible && (
        <CaretRightOutlined
          className={`ops-collapse-chevron${open ? " ops-open" : ""}`}
          onClick={toggle}
        />
      )}
    </Space>
  );

  return (
    <Card
      size="small"
      className={`ops-section-card${collapsible ? " ops-collapsible" : ""}${
        primary ? " ops-section-primary" : ""
      }`}
      title={headTitle}
      extra={headExtra}
      styles={{ body: open ? undefined : { display: "none" } }}
    >
      {children}
    </Card>
  );
}
