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

/**
 * Split a 1-D "content" profile (e.g. edge density per column) into runs of
 * content separated by gutters.
 *
 * A gutter is a stretch of at least `minGap` samples whose value is below
 * `threshold`. Returns [start, end) pairs of the content runs between gutters,
 * ignoring runs shorter than `minRun`.
 */
export function findSegments(profile: ArrayLike<number>, threshold: number, minGap: number, minRun: number): [number, number][] {
  const n = profile.length;
  const segments: [number, number][] = [];
  let runStart = -1;
  let quiet = 0;
  for (let i = 0; i <= n; i++) {
    const isContent = i < n && profile[i] >= threshold;
    if (isContent) {
      if (runStart < 0) runStart = i;
      quiet = 0;
    } else if (runStart >= 0) {
      quiet++;
      // Close the run once the gutter is wide enough, or at the end of the profile.
      if (quiet >= minGap || i === n) {
        const end = i - quiet + 1;
        if (end - runStart >= minRun) segments.push([runStart, end]);
        runStart = -1;
        quiet = 0;
      }
    }
  }
  return segments;
}

/** `count` equal-width segments spanning [0, length). */
export function equalSegments(length: number, count: number): [number, number][] {
  const step = length / count;
  return Array.from({ length: count }, (_, i) => [i * step, (i + 1) * step] as [number, number]);
}

/** True when all segment lengths are within `tolerance` (ratio) of each other. */
export function segmentsAreUniform(segs: [number, number][], tolerance = 1.35): boolean {
  if (segs.length === 0) return false;
  const lens = segs.map(([a, b]) => b - a);
  return Math.max(...lens) / Math.min(...lens) <= tolerance;
}

/**
 * Guess rows × columns for a grid of `aspect`-shaped cells covering w × h.
 *
 * Hints (detected gutter counts or user input, 0 = unknown) are tried first;
 * the winner is whichever candidate produces cells closest to the target aspect.
 * Without usable hints we take the smallest row count that fits well — a sheet
 * of 2×2 and one of 4×4 have the same overall shape, so this can be wrong, and
 * the UI lets the user type the counts in.
 */
export function autoGridCounts(w: number, h: number, aspect: number, colsHint: number, rowsHint: number): { rows: number; cols: number } {
  const err = (r: number, c: number) => Math.abs(Math.log((w / c) / (h / r) / aspect));
  const candidates: { rows: number; cols: number }[] = [];
  if (rowsHint >= 1 && colsHint >= 1) candidates.push({ rows: rowsHint, cols: colsHint });
  if (colsHint >= 1) candidates.push({ cols: colsHint, rows: Math.max(1, Math.round((h * aspect * colsHint) / w)) });
  if (rowsHint >= 1) candidates.push({ rows: rowsHint, cols: Math.max(1, Math.round((w * rowsHint) / (h * aspect))) });
  const hinted = candidates.filter((c) => err(c.rows, c.cols) < 0.15);
  if (hinted.length) return hinted.reduce((a, b) => (err(a.rows, a.cols) <= err(b.rows, b.cols) ? a : b));

  let best = { rows: 1, cols: 1 };
  for (let r = 1; r <= 6; r++) {
    const c = Math.max(1, Math.round((w * r) / (h * aspect)));
    if (err(r, c) < 0.12) return { rows: r, cols: c };
    if (err(r, c) < err(best.rows, best.cols)) best = { rows: r, cols: c };
  }
  return best;
}

/**
 * Pick the segmentation for one grid axis: use the detected gutters when they
 * produce the expected number of evenly sized cells, otherwise divide evenly.
 * With `expected` = 0 (auto), trust the gutters only if they look uniform.
 */
export function chooseAxisSegments(
  detected: [number, number][],
  length: number,
  expected: number,
  autoFallback: number,
): [number, number][] {
  if (expected > 0) {
    return detected.length === expected && segmentsAreUniform(detected) ? detected : equalSegments(length, expected);
  }
  if (detected.length >= 1 && segmentsAreUniform(detected)) return detected;
  return equalSegments(length, Math.max(1, autoFallback));
}
