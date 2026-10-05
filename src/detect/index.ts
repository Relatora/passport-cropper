/**
 * Single entry point for all three detection modes. Every mode ends up as a list
 * of rotated boxes in full-resolution source pixels, already shaped to the
 * selected preset's aspect ratio, ready for the editor.
 */
import { fitAspectInside, readingOrder } from '../geometry';
import { presetAspect } from '../presets';
import type { DetectMode, RawBox, SizePreset } from '../types';
import { runCv } from './cvClient';
import { autoOrient, detectFaceBoxes, frameFacesInBlobs } from './faces';

/** Longest side of the copy OpenCV works on; plenty for finding photo outlines. */
const CV_MAX_SIDE = 1600;

export interface DetectOptions {
  mode: DetectMode;
  preset: SizePreset;
  /** Scan mode: use face detection to turn sideways or upside-down photos upright. */
  orient: boolean;
  onStatus?: (msg: string) => void;
}

function downscaledImageData(source: ImageBitmap): { data: ImageData; scale: number } {
  const scale = Math.min(1, CV_MAX_SIDE / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), scale };
}

export async function detect(source: ImageBitmap, opts: DetectOptions): Promise<RawBox[]> {
  const { mode, preset } = opts;
  if (mode === 'faces') {
    opts.onStatus?.('Finding faces…');
    return detectFaceBoxes(source, preset);
  }

  opts.onStatus?.('Loading OpenCV and finding photos…');
  const { data, scale } = downscaledImageData(source);
  const { boxes: raw, blobs } = await runCv({ kind: 'scan', image: data, aspect: presetAspect(preset) });
  const toFull = (b: RawBox): RawBox => ({ cx: b.cx / scale, cy: b.cy / scale, width: b.width / scale, height: b.height / scale, angleDeg: b.angleDeg });

  // Shrink each rectangle to the preset's shape. The small inset keeps
  // scanner-bed slivers and paper edges out of the crop.
  let boxes = raw.map(toFull).map((b) => ({ ...b, ...fitAspectInside(b.width, b.height, presetAspect(preset), 0.02) }));

  if (opts.orient && boxes.length) {
    opts.onStatus?.('Checking photo orientation…');
    const oriented: RawBox[] = [];
    for (const b of boxes) oriented.push(await autoOrient(source, b));
    boxes = oriented;
  }

  if (blobs.length) {
    // Photos without a visible edge: place the crop around the face instead.
    opts.onStatus?.('Finding faces in photos without a visible edge…');
    boxes = [...boxes, ...(await frameFacesInBlobs(source, blobs.map(toFull), boxes, preset))];
  }
  return readingOrder(boxes, Math.min(source.width, source.height) * 0.15);
}
