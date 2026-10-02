import JSZip from 'jszip';
import { presetPixels } from '../presets';
import type { CropBox, SizePreset } from '../types';
import { setJpegDpi } from './jfifDpi';
import { canvasToJpeg, renderCrop } from './renderCrop';

/** Render one box at final print size and return a DPI-tagged JPEG. */
export async function exportPhoto(source: CanvasImageSource, box: CropBox, preset: SizePreset, dpi: number): Promise<Blob> {
  const { width, height } = presetPixels(preset, dpi);
  const canvas = renderCrop(source, box, width, height);
  const bytes = new Uint8Array(await (await canvasToJpeg(canvas)).arrayBuffer());
  return new Blob([setJpegDpi(bytes, dpi)], { type: 'image/jpeg' });
}

export function photoFileName(base: string, index: number, preset: SizePreset): string {
  return `${base}-${String(index + 1).padStart(2, '0')}-${preset.widthMm}x${preset.heightMm}mm.jpg`;
}

export async function exportZip(source: CanvasImageSource, boxes: CropBox[], preset: SizePreset, dpi: number, base: string): Promise<Blob> {
  const zip = new JSZip();
  for (let i = 0; i < boxes.length; i++) {
    zip.file(photoFileName(base, i, preset), await exportPhoto(source, boxes[i], preset, dpi));
  }
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
