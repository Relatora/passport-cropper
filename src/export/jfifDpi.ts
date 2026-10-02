/**
 * Browsers write JPEGs with a JFIF header that says "no physical units", so a
 * print shop or photo printer can't tell how big a 413 × 531 px image should be.
 * This patches (or inserts) the JFIF APP0 segment to carry the real DPI, so a
 * 35 × 45 mm photo prints at 35 × 45 mm.
 *
 * JFIF APP0 layout:
 *   FFD8 | FFE0 len(2) "JFIF\0" ver(2) units(1) Xdensity(2) Ydensity(2) thumbW(1) thumbH(1)
 */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('Not a JPEG');
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  const isJfif =
    jpeg[2] === 0xff && jpeg[3] === 0xe0 &&
    jpeg[6] === 0x4a && jpeg[7] === 0x46 && jpeg[8] === 0x49 && jpeg[9] === 0x46 && jpeg[10] === 0x00;

  if (isJfif) {
    const out = jpeg.slice();
    out[13] = 1; // units: dots per inch
    out[14] = d >> 8; out[15] = d & 0xff;
    out[16] = d >> 8; out[17] = d & 0xff;
    return out;
  }

  // No JFIF segment: insert a minimal one right after the SOI marker.
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02,
    0x01, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00,
  ]);
  const out = new Uint8Array(jpeg.length + app0.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(jpeg.subarray(2), 2 + app0.length);
  return out;
}

/** Read back the DPI from a JFIF header (null when absent or unit-less). */
export function readJpegDpi(jpeg: Uint8Array): number | null {
  if (jpeg[2] !== 0xff || jpeg[3] !== 0xe0 || jpeg[13] !== 1) return null;
  return (jpeg[14] << 8) | jpeg[15];
}
