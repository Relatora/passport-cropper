/**
 * Pure geometry helpers shared by the detectors, the editor and the exporter.
 * Nothing here touches the DOM, so it is all unit-tested in geometry.test.ts.
 */
import type { RawBox } from './types';

export const DEG = Math.PI / 180;

/**
 * Re-express a rotated rectangle so its tilt is in (-45°, 45°], swapping the
 * sides as needed. Describes the same rectangle; only the labelling changes.
 */
export function normalizeTilt(width: number, height: number, angleDeg: number): { width: number; height: number; angleDeg: number } {
  let w = width;
  let h = height;
  let a = angleDeg;
  while (a > 45) { a -= 90; [w, h] = [h, w]; }
  while (a <= -45) { a += 90; [w, h] = [h, w]; }
  return { width: w, height: h, angleDeg: a };
}

/**
 * Turn an OpenCV RotatedRect (whose angle convention changed between versions)
 * into a box with a small tilt in (-45°, 45°] and portrait orientation.
 *
 * Passport photos are never landscape, so a landscape rect means the photo is
 * lying on its side; we rotate the box by 90° so its "top" points at one of the
 * long sides. Whether that is the correct long side (90° vs 270°) can't be known
 * from geometry alone — the face-based orientation pass decides that later.
 */
export function normalizeRect(width: number, height: number, angleDeg: number): { width: number; height: number; angleDeg: number } {
  const r = normalizeTilt(width, height, angleDeg);
  if (r.width > r.height * 1.05) return { width: r.height, height: r.width, angleDeg: r.angleDeg + 90 };
  return r;
}

/** Wrap any angle into (-180°, 180°]. */
export function wrapAngle(a: number): number {
  let r = a % 360;
  if (r <= -180) r += 360;
  if (r > 180) r -= 360;
  return r;
}

/**
 * Largest rectangle with the given aspect (w/h) that fits inside w × h,
 * shrunk by `inset` (fraction) so we don't catch the paper edge or scanner bed.
 */
export function fitAspectInside(width: number, height: number, aspect: number, inset = 0): { width: number; height: number } {
  let w = width;
  let h = w / aspect;
  if (h > height) {
    h = height;
    w = h * aspect;
  }
  return { width: w * (1 - inset), height: h * (1 - inset) };
}

/** Rotate a vector clockwise (image space, y down) by `deg`. */
export function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** The four corners of a rotated box, clockwise from its top-left. */
export function boxCorners(b: Pick<RawBox, 'cx' | 'cy' | 'width' | 'height' | 'angleDeg'>): { x: number; y: number }[] {
  const hw = b.width / 2;
  const hh = b.height / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => {
    const r = rotateVec(x, y, b.angleDeg);
    return { x: b.cx + r.x, y: b.cy + r.y };
  });
}

/** Sort boxes top-to-bottom in bands of `band` pixels, then left-to-right. */
export function readingOrder<T extends Pick<RawBox, 'cx' | 'cy'>>(boxes: T[], band: number): T[] {
  return [...boxes].sort((a, b) => Math.round(a.cy / band) - Math.round(b.cy / band) || a.cx - b.cx);
}

/** Is point (x, y) inside the rotated box? */
export function pointInBox(x: number, y: number, b: Pick<RawBox, 'cx' | 'cy' | 'width' | 'height' | 'angleDeg'>): boolean {
  // Undo the box rotation so the test becomes an axis-aligned one.
  const p = rotateVec(x - b.cx, y - b.cy, -b.angleDeg);
  return Math.abs(p.x) <= b.width / 2 && Math.abs(p.y) <= b.height / 2;
}

/** Intersection-over-union of two axis-aligned rectangles. */
export function iou(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}
