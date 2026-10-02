import { DEG } from '../geometry';
import type { RawBox } from '../types';

/**
 * Render one rotated crop box of `source` into a new canvas of outW × outH.
 *
 * The canvas transform maps the box's local frame onto the output:
 * translate to the output centre, scale box pixels to output pixels, undo the
 * box rotation, then move the box centre to the origin. Anything outside the
 * source image is filled white, which is what passport photos expect anyway.
 */
export function renderCrop(
  source: CanvasImageSource,
  box: Pick<RawBox, 'cx' | 'cy' | 'width' | 'height' | 'angleDeg'>,
  outW: number,
  outH: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(outW));
  canvas.height = Math.max(1, Math.round(outH));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(canvas.width / box.width, canvas.height / box.height);
  ctx.rotate(-box.angleDeg * DEG);
  ctx.translate(-box.cx, -box.cy);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality),
  );
}
