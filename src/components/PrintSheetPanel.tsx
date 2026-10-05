import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadBlob } from '../export/zipExport';
import { exportSheet, layoutSheet, renderSheet, sheetDpi, sheetName, SHEETS } from '../export/printSheet';
import type { CropBox, SizePreset } from '../types';
import { IconDownload } from './Icons';

interface Props {
  image: ImageBitmap;
  boxes: CropBox[];
  preset: SizePreset;
  sizeName: string;
  dpi: number;
  baseName: string;
}

/** Longest side of the on-screen sheet preview, in CSS pixels. */
const PREVIEW_PX = 380;

/**
 * Tile the passport photos onto one standard print (4 × 6 in, 5 × 7 in, A4 or
 * Letter) with a live preview, so the photos can be printed for cents at a photo
 * counter or at home.
 */
export function PrintSheetPanel({ image, boxes, preset, sizeName, dpi, baseName }: Props) {
  const [sheetId, setSheetId] = useState(SHEETS[0].id);
  /** 'all' cycles through every photo; otherwise one box id fills the whole sheet. */
  const [content, setContent] = useState<string>('all');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sheet = SHEETS.find((s) => s.id === sheetId)!;
  const layout = useMemo(() => layoutSheet(sheet, preset), [sheet, preset]);
  // With a single photo there is no "all" option; fall back to that photo.
  const value = boxes.some((b) => b.id === content) || boxes.length > 1 ? content : boxes[0]?.id ?? 'all';
  const chosen = useMemo(() => {
    const one = boxes.find((b) => b.id === value);
    return one ? [one] : boxes;
  }, [boxes, value]);
  const outDpi = sheetDpi(layout, dpi);

  // Re-render the preview shortly after anything changes (boxes change while dragging).
  useEffect(() => {
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = (PREVIEW_PX / Math.max(layout.widthMm, layout.heightMm)) * (window.devicePixelRatio || 1);
      const rendered = renderSheet(image, chosen, preset, layout, scale);
      canvas.width = rendered.width;
      canvas.height = rendered.height;
      canvas.style.aspectRatio = `${layout.widthMm} / ${layout.heightMm}`;
      canvas.getContext('2d')!.drawImage(rendered, 0, 0);
      canvas.classList.remove('flash');
      void canvas.offsetWidth; // restart the fade-in animation
      canvas.classList.add('flash');
    }, 120);
    return () => clearTimeout(timer);
  }, [image, chosen, preset, layout]);

  const download = async () => {
    setBusy(true);
    try {
      const { blob } = await exportSheet(image, chosen, preset, sheet, dpi);
      downloadBlob(blob, `${baseName}-print-sheet-${sheet.id}.jpg`);
    } finally {
      setBusy(false);
    }
  };

  const count = layout.cells.length;
  return (
    <section className="sheet-panel" id="print-sheet" aria-labelledby="sheet-title">
      <div className="sheet-preview">
        <canvas ref={canvasRef} role="img" aria-label={`Preview: ${count} photos on a ${sheetName(sheet)} sheet`} />
      </div>
      <div className="sheet-controls">
        <h2 id="sheet-title">Print sheet</h2>
        <p className="sheet-pitch">
          Put all copies on <strong>one photo print</strong>. It costs cents at a photo counter,
          instead of paying for passport photos at a shop.
        </p>
        <label>
          Sheet
          <select value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
            {SHEETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label>
          Photos on the sheet
          <select value={value} onChange={(e) => setContent(e.target.value)}>
            {boxes.length > 1 && <option value="all">All {boxes.length} photos, alternating</option>}
            {boxes.map((b, i) => <option key={b.id} value={b.id}>Photo {i + 1} only</option>)}
          </select>
        </label>
        <p className={`sheet-fit${count ? '' : ' none'}`}>
          {count
            ? <>Fits <strong>{count} photo{count === 1 ? '' : 's'}</strong> ({sizeName}) · {outDpi} dpi{outDpi < dpi ? ' (largest size browsers can make)' : ''}</>
            : <>A {sizeName} photo doesn’t fit on this sheet. Choose a bigger one.</>}
        </p>
        <button type="button" className="primary" disabled={!count || busy} onClick={download}>
          <IconDownload /> {busy ? 'Preparing…' : 'Download print sheet'}
        </button>
        <small>
          Print at <strong>Actual size / 100 %</strong>{sheet.marginMm === 0 ? ', borderless' : ''}, then cut along the grey lines.
        </small>
      </div>
    </section>
  );
}
