/**
 * Print sheets: many copies of the passport photos tiled onto one standard print,
 * e.g. eight 35 × 45 mm photos on a single 4 × 6 in photo print, which costs
 * cents at a photo counter instead of the price of a passport-photo booth.
 *
 * The layout maths is pure (unit-tested in printSheet.test.ts); rendering uses a canvas.
 */
import { canvasToJpeg, renderCrop } from './renderCrop';
import { setJpegDpi } from './jfifDpi';
import type { RawBox, SizePreset } from '../types';

export interface SheetSize {
  id: string;
  label: string;
  /** Portrait dimensions; the layout may turn the sheet landscape. */
  widthMm: number;
  heightMm: number;
  /**
   * Unprintable border to keep clear. Photo labs print 4 × 6 / 5 × 7 borderless,
   * home printers need a margin on A4 / Letter paper.
   */
  marginMm: number;
}

export const SHEETS: SheetSize[] = [
  { id: '4x6', label: '4 × 6 in photo print (10 × 15 cm)', widthMm: 101.6, heightMm: 152.4, marginMm: 0 },
  { id: '5x7', label: '5 × 7 in photo print (13 × 18 cm)', widthMm: 127, heightMm: 177.8, marginMm: 0 },
  { id: 'a4', label: 'A4 paper (home printer)', widthMm: 210, heightMm: 297, marginMm: 6 },
  { id: 'letter', label: 'US Letter paper (home printer)', widthMm: 215.9, heightMm: 279.4, marginMm: 6 },
];

/** Short name for UI text and file names, e.g. "4 × 6 in". */
export const sheetName = (s: SheetSize) => s.label.replace(/\s*(photo print|paper).*$/, '');

export interface SheetLayout {
  /** Sheet dimensions as laid out (possibly turned landscape). */
  widthMm: number;
  heightMm: number;
  landscape: boolean;
  cols: number;
  rows: number;
  /** Top-left corner of every photo, row by row. */
  cells: { xMm: number; yMm: number }[];
}

/**
 * Fit as many `photo`-sized cells as possible on the sheet, trying it both portrait
 * and landscape. Photos are packed edge to edge for the count, then the leftover
 * space is shared out evenly between and around them, so cutting is easy.
 */
export function layoutSheet(sheet: SheetSize, photo: { widthMm: number; heightMm: number }): SheetLayout {
  const fit = (W: number, H: number, landscape: boolean): SheetLayout => {
    const usableW = W - 2 * sheet.marginMm;
    const usableH = H - 2 * sheet.marginMm;
    const cols = Math.max(0, Math.floor(usableW / photo.widthMm + 1e-9));
    const rows = Math.max(0, Math.floor(usableH / photo.heightMm + 1e-9));
    // Even spacing: equal gaps between photos and to the margin on each axis.
    const gapX = (usableW - cols * photo.widthMm) / (cols + 1);
    const gapY = (usableH - rows * photo.heightMm) / (rows + 1);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({
          xMm: sheet.marginMm + gapX + c * (photo.widthMm + gapX),
          yMm: sheet.marginMm + gapY + r * (photo.heightMm + gapY),
        });
      }
    }
    return { widthMm: W, heightMm: H, landscape, cols, rows, cells };
  };
  const portrait = fit(sheet.widthMm, sheet.heightMm, false);
  const landscape = fit(sheet.heightMm, sheet.widthMm, true);
  return landscape.cells.length > portrait.cells.length ? landscape : portrait;
}

/**
 * Some browsers (notably iOS Safari) refuse canvases above ~16.7 megapixels, so a
 * sheet is rendered at the chosen DPI only if it fits; otherwise at 600, then 300 dpi.
 */
export const MAX_SHEET_PIXELS = 16_000_000;

export function sheetDpi(layout: Pick<SheetLayout, 'widthMm' | 'heightMm'>, requestedDpi: number): number {
  const pixels = (dpi: number) => ((layout.widthMm / 25.4) * dpi) * ((layout.heightMm / 25.4) * dpi);
  for (const dpi of [requestedDpi, 600, 300]) {
    if (dpi <= requestedDpi && pixels(dpi) <= MAX_SHEET_PIXELS) return dpi;
  }
  return 300;
}

/**
 * Draw the sheet: white paper, each cell filled with the next photo from `boxes`
 * (cycling, so one photo fills the sheet and several photos alternate), and a
 * light hairline around every photo as a cutting guide.
 */
export function renderSheet(
  source: CanvasImageSource,
  boxes: RawBox[],
  preset: SizePreset,
  layout: SheetLayout,
  pxPerMm: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.widthMm * pxPerMm);
  canvas.height = Math.round(layout.heightMm * pxPerMm);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!boxes.length || !layout.cells.length) return canvas;

  const pw = Math.round(preset.widthMm * pxPerMm);
  const ph = Math.round(preset.heightMm * pxPerMm);
  // Each distinct photo is rendered once and then stamped onto every cell it fills.
  const tiles = boxes.map((b) => renderCrop(source, b, pw, ph));
  ctx.strokeStyle = '#c4c4c4';
  ctx.lineWidth = Math.max(1, pxPerMm * 0.08);
  layout.cells.forEach((cell, i) => {
    const x = Math.round(cell.xMm * pxPerMm);
    const y = Math.round(cell.yMm * pxPerMm);
    ctx.drawImage(tiles[i % tiles.length], x, y);
    ctx.strokeRect(x - ctx.lineWidth / 2, y - ctx.lineWidth / 2, pw + ctx.lineWidth, ph + ctx.lineWidth);
  });
  return canvas;
}

/** The full-resolution sheet as a DPI-tagged JPEG. */
export async function exportSheet(
  source: CanvasImageSource,
  boxes: RawBox[],
  preset: SizePreset,
  sheet: SheetSize,
  requestedDpi: number,
): Promise<{ blob: Blob; dpi: number; count: number }> {
  const layout = layoutSheet(sheet, preset);
  const dpi = sheetDpi(layout, requestedDpi);
  const canvas = renderSheet(source, boxes, preset, layout, dpi / 25.4);
  const bytes = new Uint8Array(await (await canvasToJpeg(canvas)).arrayBuffer());
  return { blob: new Blob([setJpegDpi(bytes, dpi)], { type: 'image/jpeg' }), dpi, count: layout.cells.length };
}
