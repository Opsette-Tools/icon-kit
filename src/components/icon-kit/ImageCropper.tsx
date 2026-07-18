import { useEffect, useRef, useState, useCallback } from "react";
import { Modal, Button, Space, Typography, Switch, App } from "antd";
import { ScissorOutlined } from "@ant-design/icons";
import { loadImage } from "../../lib/icon-kit/canvas";
import { bakeCrop, autoTrimRect, type CropRect } from "../../lib/icon-kit/crop";

// A self-contained square-crop dialog. The user drags/resizes a selection box
// over the uploaded image to frame just the part they want (e.g. the badge on
// the left of a wide logo). On confirm we bake the crop at the image's NATIVE
// resolution (see crop.ts) so nothing is softened before the icon pipeline runs.
//
// No cropping library: the interaction is a lightweight pointer-driven box over
// the displayed image, and the actual pixel crop is done on an offscreen canvas.
// The box lives in FRACTIONAL coords (0..1 of the source), so it's resolution-
// independent and maps straight onto bakeCrop's CropRect.

type Props = {
  open: boolean;
  /** The original, uncropped image (data URL). */
  imageDataUrl: string;
  /** Crop already applied, so reopening restores the box. */
  initialRect?: CropRect | null;
  onCancel: () => void;
  /** Returns both the baked (cropped) data URL and the rect that produced it. */
  onApply: (result: { croppedDataUrl: string; rect: CropRect }) => void;
};

type Handle =
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | null;

// A sensible default box: the largest centered square (favicons are square).
function defaultSquare(imgW: number, imgH: number): CropRect {
  const side = Math.min(imgW, imgH);
  return {
    x: (imgW - side) / 2 / imgW,
    y: (imgH - side) / 2 / imgH,
    w: side / imgW,
    h: side / imgH,
  };
}

export function ImageCropper({ open, imageDataUrl, initialRect, onCancel, onApply }: Props) {
  const { message } = App.useApp();
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  // Displayed box in CSS pixels within the image element.
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [square, setSquare] = useState(true);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  // The rendered image's on-screen box (it's object-fit: contain inside wrap).
  const rectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  const measureImage = useCallback(() => {
    const imgEl = imgRef.current;
    const wrap = wrapRef.current;
    if (!imgEl || !wrap || !imgSize) return null;
    const wrapRect = wrap.getBoundingClientRect();
    // object-fit: contain — compute the letterboxed draw box.
    const scale = Math.min(wrapRect.width / imgSize.w, wrapRect.height / imgSize.h);
    const width = imgSize.w * scale;
    const height = imgSize.h * scale;
    const left = (wrapRect.width - width) / 2;
    const top = (wrapRect.height - height) / 2;
    const r = { left, top, width, height };
    rectRef.current = r;
    return r;
  }, [imgSize]);

  // Load image + seed the box when the dialog opens.
  useEffect(() => {
    if (!open || !imageDataUrl) return;
    let alive = true;
    (async () => {
      const img = await loadImage(imageDataUrl);
      if (!alive) return;
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    })();
    return () => {
      alive = false;
    };
  }, [open, imageDataUrl]);

  // Once the image is measured on screen, place the box from the initial rect
  // (or a centered default square).
  useEffect(() => {
    if (!open || !imgSize) return;
    // Defer to next frame so the wrap has laid out.
    const id = requestAnimationFrame(() => {
      const r = measureImage();
      if (!r) return;
      const frac = initialRect ?? defaultSquare(imgSize.w, imgSize.h);
      setBox({
        x: r.left + frac.x * r.width,
        y: r.top + frac.y * r.height,
        w: frac.w * r.width,
        h: frac.h * r.height,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [open, imgSize, initialRect, measureImage]);

  const clampBox = useCallback(
    (b: { x: number; y: number; w: number; h: number }) => {
      const r = rectRef.current;
      if (!r) return b;
      const minSide = 24;
      let { x, y, w, h } = b;
      w = Math.max(minSide, Math.min(w, r.width));
      h = Math.max(minSide, Math.min(h, r.height));
      x = Math.max(r.left, Math.min(x, r.left + r.width - w));
      y = Math.max(r.top, Math.min(y, r.top + r.height - h));
      return { x, y, w, h };
    },
    [],
  );

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, orig: { ...box } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !drag.handle) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const o = drag.orig;

    if (drag.handle === "move") {
      setBox(clampBox({ x: o.x + dx, y: o.y + dy, w: o.w, h: o.h }));
      return;
    }

    // Corner resize with the OPPOSITE corner as a fixed anchor. This is the clean
    // model: find the anchor point, find the dragged corner's new position, then
    // rebuild the box between them. Square-lock just forces both sides to the
    // larger dimension before rebuilding, keeping the anchor put.
    const right = o.x + o.w;
    const bottom = o.y + o.h;
    // Anchor = the corner diagonally opposite the one being dragged.
    const anchorX = drag.handle === "nw" || drag.handle === "sw" ? right : o.x;
    const anchorY = drag.handle === "nw" || drag.handle === "ne" ? bottom : o.y;
    // The dragged corner's new position.
    const cornerX = (drag.handle === "nw" || drag.handle === "sw" ? o.x : right) + dx;
    const cornerY = (drag.handle === "nw" || drag.handle === "ne" ? o.y : bottom) + dy;

    let w = Math.abs(cornerX - anchorX);
    let h = Math.abs(cornerY - anchorY);
    if (square) {
      const side = Math.max(w, h);
      w = side;
      h = side;
    }
    // Place the box: the corner grows away from the anchor in the drag direction.
    const nx = cornerX >= anchorX ? anchorX : anchorX - w;
    const ny = cornerY >= anchorY ? anchorY : anchorY - h;
    setBox(clampBox({ x: nx, y: ny, w, h }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  // Convert the on-screen box → fractional source rect for baking.
  const boxToRect = (): CropRect | null => {
    const r = rectRef.current;
    if (!box || !r) return null;
    return {
      x: (box.x - r.left) / r.width,
      y: (box.y - r.top) / r.height,
      w: box.w / r.width,
      h: box.h / r.height,
    };
  };

  async function handleApply() {
    const rect = boxToRect();
    if (!rect) return;
    setBusy(true);
    try {
      const croppedDataUrl = await bakeCrop(imageDataUrl, rect);
      onApply({ croppedDataUrl, rect });
    } catch {
      message.error("Couldn't crop that image.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAutoTrim() {
    if (!imgSize) return;
    setBusy(true);
    try {
      const frac = await autoTrimRect(imageDataUrl);
      const r = measureImage();
      if (!r) return;
      // Auto-trim gives a tight (possibly non-square) box. If square-lock is on,
      // expand it to the enclosing square so the favicon isn't letterboxed.
      let f = frac;
      if (square) {
        const side = Math.max(frac.w * imgSize.w, frac.h * imgSize.h);
        const cxp = (frac.x + frac.w / 2) * imgSize.w;
        const cyp = (frac.y + frac.h / 2) * imgSize.h;
        f = {
          x: (cxp - side / 2) / imgSize.w,
          y: (cyp - side / 2) / imgSize.h,
          w: side / imgSize.w,
          h: side / imgSize.h,
        };
      }
      setBox(
        clampBox({
          x: r.left + f.x * r.width,
          y: r.top + f.y * r.height,
          w: f.w * r.width,
          h: f.h * r.height,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  const HANDLE_SIZE = 14;
  const handleStyle = (pos: Handle): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      background: "#fff",
      border: "2px solid #2f4f46",
      borderRadius: 3,
      boxSizing: "border-box",
      touchAction: "none",
    };
    const off = -HANDLE_SIZE / 2;
    switch (pos) {
      case "nw": return { ...base, left: off, top: off, cursor: "nwse-resize" };
      case "ne": return { ...base, right: off, top: off, cursor: "nesw-resize" };
      case "sw": return { ...base, left: off, bottom: off, cursor: "nesw-resize" };
      case "se": return { ...base, right: off, bottom: off, cursor: "nwse-resize" };
      default: return base;
    }
  };

  return (
    <Modal
      open={open}
      title="Crop your image"
      onCancel={onCancel}
      width={640}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="apply" type="primary" icon={<ScissorOutlined />} loading={busy} onClick={handleApply}>
          Use this crop
        </Button>,
      ]}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }}>
          Drag the box over the part you want — for a favicon, frame just the icon
          or badge. Corners resize it. We crop at your image's full resolution, so
          it stays as sharp as the original.
        </Typography.Paragraph>

        <div
          ref={wrapRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: "relative",
            width: "100%",
            height: 360,
            background: "repeating-conic-gradient(#f0f0f0 0 25%, #fafafa 0 50%) 50% / 20px 20px",
            borderRadius: 8,
            overflow: "hidden",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          {imageDataUrl && (
            <img
              src={imageDataUrl}
              alt="Crop source"
              onLoad={measureImage}
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
              }}
            />
          )}

          {box && (
            <div
              onPointerDown={onPointerDown("move")}
              style={{
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
                border: "2px solid #2f4f46",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                cursor: "move",
                boxSizing: "border-box",
                touchAction: "none",
              }}
            >
              {/* Rule-of-thirds guides for framing. */}
              <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.5)" }} />
              <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.5)" }} />
              <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.5)" }} />
              <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.5)" }} />
              <div style={handleStyle("nw")} onPointerDown={onPointerDown("nw")} />
              <div style={handleStyle("ne")} onPointerDown={onPointerDown("ne")} />
              <div style={handleStyle("sw")} onPointerDown={onPointerDown("sw")} />
              <div style={handleStyle("se")} onPointerDown={onPointerDown("se")} />
            </div>
          )}
        </div>

        <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
          <Space size={8}>
            <Switch checked={square} onChange={setSquare} size="small" />
            <Typography.Text style={{ fontSize: 13 }}>Lock to square (best for icons)</Typography.Text>
          </Space>
          <Button size="small" onClick={handleAutoTrim} loading={busy}>
            Auto-trim edges
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
