// Minimal ICO encoder that embeds PNG payloads (supported by all modern browsers/OSes).

export async function encodeIco(pngBlobs: { size: number; blob: Blob }[]): Promise<Blob> {
  const entries = await Promise.all(
    pngBlobs.map(async ({ size, blob }) => ({
      size,
      bytes: new Uint8Array(await blob.arrayBuffer()),
    })),
  );

  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = entries.length * dirEntrySize;
  let offset = headerSize + dirSize;

  const totalSize = offset + entries.reduce((s, e) => s + e.bytes.length, 0);
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = 1 (icon)
  view.setUint16(4, entries.length, true);

  let dirOffset = headerSize;
  for (const e of entries) {
    view.setUint8(dirOffset + 0, e.size >= 256 ? 0 : e.size); // width
    view.setUint8(dirOffset + 1, e.size >= 256 ? 0 : e.size); // height
    view.setUint8(dirOffset + 2, 0); // color count
    view.setUint8(dirOffset + 3, 0); // reserved
    view.setUint16(dirOffset + 4, 1, true); // planes
    view.setUint16(dirOffset + 6, 32, true); // bit count
    view.setUint32(dirOffset + 8, e.bytes.length, true); // bytes in res
    view.setUint32(dirOffset + 12, offset, true); // image offset
    out.set(e.bytes, offset);
    offset += e.bytes.length;
    dirOffset += dirEntrySize;
  }

  return new Blob([buf], { type: "image/x-icon" });
}