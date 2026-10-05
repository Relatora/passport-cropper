/**
 * Photo-outline detection with OpenCV.js. Pure functions of (cv, ImageData) so
 * they run unchanged in the Web Worker and in Node for debugging/tests.
 *
 * Results are rotated rectangles in the coordinates of the ImageData given;
 * aspect-ratio fitting, face-based orientation and scaling to full resolution
 * happen on the main thread.
 */
import { normalizeRect, normalizeTilt, rotateVec, wrapAngle } from '../geometry';
import type { RawBox } from '../types';

// OpenCV.js typings don't cover the full runtime API (MatVector, roi, data32S…).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CV = any;

/** How far (0-255, any channel) a pixel must be from the background colour to count as content. */
const BG_TOLERANCE = 10;

/**
 * Median colour of the image's outer frame, i.e. the scanner bed or the paper.
 * The median ignores a photo that happens to touch the edge.
 */
export function borderColor(image: ImageData): [number, number, number] {
  const { width: w, height: h, data } = image;
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  const ch: number[][] = [[], [], []];
  const take = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    ch[0].push(data[i]); ch[1].push(data[i + 1]); ch[2].push(data[i + 2]);
  };
  for (let y = 0; y < h; y++) {
    if (y < t || y >= h - t) {
      for (let x = 0; x < w; x++) take(x, y); // top and bottom strips
    } else {
      for (let x = 0; x < t; x++) { take(x, y); take(w - 1 - x, y); } // left and right strips
    }
  }
  const median = (a: number[]) => a.sort((p, q) => p - q)[a.length >> 1] ?? 255;
  return [median(ch[0]), median(ch[1]), median(ch[2])];
}

interface Masks {
  /** Pixels that differ from the background colour. */
  content: CV;
  /** `content` OR dilated edges, morphologically closed: solid photo blobs. */
  solid: CV;
  gray: CV;
}

/**
 * Two cues are combined because neither is enough on its own:
 *  - colour distance from the background catches photos whose backdrop is only
 *    slightly off the scanner-bed white (too subtle for Otsu or Canny);
 *  - dilated Canny edges catch the paper border of a pure-white photo lying on
 *    a white scanner, where colour alone sees nothing.
 * A morphological close then fills the remaining small breaks.
 */
function buildMasks(cv: CV, image: ImageData, closeSize: number, track: CV[]): Masks {
  const rgba = cv.matFromImageData(image); track.push(rgba);
  const blur = new cv.Mat(); track.push(blur);
  cv.GaussianBlur(rgba, blur, new cv.Size(5, 5), 0);

  const [r, g, b] = borderColor(image);
  const bg = new cv.Mat(image.height, image.width, cv.CV_8UC4, new cv.Scalar(r, g, b, 255)); track.push(bg);
  const diff = new cv.Mat(); track.push(diff);
  cv.absdiff(blur, bg, diff);
  const planes = new cv.MatVector(); track.push(planes);
  cv.split(diff, planes);
  const content = new cv.Mat(); track.push(content);
  const p0 = planes.get(0), p1 = planes.get(1), p2 = planes.get(2);
  cv.max(p0, p1, content);
  cv.max(content, p2, content);
  p0.delete(); p1.delete(); p2.delete();
  cv.threshold(content, content, BG_TOLERANCE, 255, cv.THRESH_BINARY);

  const gray = new cv.Mat(); track.push(gray);
  cv.cvtColor(blur, gray, cv.COLOR_RGBA2GRAY);

  // Uneven lighting (e.g. a phone photo of a table) can make "background" meaningless;
  // fall back to an Otsu split in that case.
  if (cv.countNonZero(content) > 0.8 * image.width * image.height) {
    cv.threshold(gray, content, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    if (cv.mean(content)[0] > 127) cv.bitwise_not(content, content);
  }

  const edges = new cv.Mat(); track.push(edges);
  cv.Canny(gray, edges, 20, 60);
  const k3 = cv.Mat.ones(3, 3, cv.CV_8U); track.push(k3);
  cv.dilate(edges, edges, k3, new cv.Point(-1, -1), 2);

  const solid = new cv.Mat(); track.push(solid);
  cv.bitwise_or(content, edges, solid);
  const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(closeSize, closeSize)); track.push(k);
  cv.morphologyEx(solid, solid, cv.MORPH_CLOSE, k);
  return { content, solid, gray };
}

export interface ScanResult {
  /**
   * The photos: blobs with a clear rectangular outline, plus white-backdrop
   * photos whose rectangle was rebuilt from the person's silhouette.
   */
  photos: RawBox[];
  /**
   * Large non-rectangular blobs that couldn't be rebuilt into a photo. Faces are
   * used to place the crop for these.
   */
  blobs: RawBox[];
}

/**
 * Rotate `src` by `angleDeg` counter-clockwise about (cx, cy) — undoing a
 * clockwise box tilt — into a `size` × `size` canvas centred on that point.
 */
function warpAbout(cv: CV, src: CV, cx: number, cy: number, angleDeg: number, size: number, border: number, track: CV[]): CV {
  const M = cv.getRotationMatrix2D(new cv.Point(cx, cy), angleDeg, 1); track.push(M);
  M.data64F[2] += size / 2 - cx;
  M.data64F[5] += size / 2 - cy;
  const dst = new cv.Mat(); track.push(dst);
  cv.warpAffine(src, dst, M, new cv.Size(size, size), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(border));
  return dst;
}

/** Bounding box of the non-zero pixels of a single-channel mask. */
function maskBounds(mask: CV): { x0: number; y0: number; x1: number; y1: number } | null {
  const { rows: h, cols: w } = mask;
  const d: Uint8Array = mask.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (d[row + x] > 127) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Rebuild the full photo rectangle of a white-backdrop photo on a white scanner,
 * where only the person stands out (a head-and-shoulders blob). Returns null
 * when the blob doesn't look like one, so the caller can fall back to faces.
 *
 *  1. Rotate the blob upright using its minimum-area rectangle. Of that
 *     rectangle's four sides, the one the blob fills solidly from end to end is
 *     where the photo's bottom edge cut the shoulders: that fixes which way is up.
 *  2. Re-measure the tilt by fitting a line to that straight bottom edge.
 *  3. The shoulders run into both sides of the photo, so the blob's width is the
 *     photo's width.
 *  4. Look above the head for the photo's faint top edge: a row where the
 *     brightness steps sharply all the way across. Without one, the height comes
 *     from the expected aspect ratio.
 */
function photoFromBlob(cv: CV, contours: CV, index: number, masks: Masks, blob: RawBox, aspect: number, track: CV[]): RawBox | null {
  const { content, gray } = masks;
  // The contour comes from the dilated "solid" mask, which is a few pixels too
  // fat; intersect it with the colour mask, then undo the 2 px the 5 × 5 blur
  // spreads a high-contrast silhouette by, to measure the person exactly.
  const single = cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8U); track.push(single);
  cv.drawContours(single, contours, index, new cv.Scalar(255), -1);
  cv.bitwise_and(single, content, single);
  const k5 = cv.Mat.ones(5, 5, cv.CV_8U); track.push(k5);
  cv.erode(single, single, k5);

  // 1. Which side of the blob's rectangle is the bottom of the photo?
  const size = Math.ceil(Math.hypot(blob.width, blob.height) * 2.4);
  const first = warpAbout(cv, single, blob.cx, blob.cy, blob.angleDeg, size, 0, track);
  const b = maskBounds(first);
  if (!b) return null;
  const d: Uint8Array = first.data;
  const fill = (xa: number, ya: number, xb: number, yb: number) => {
    let on = 0;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (d[y * size + x]) on++;
    return on / ((xb - xa + 1) * (yb - ya + 1));
  };
  const band = Math.max(2, Math.round(0.06 * Math.min(b.x1 - b.x0, b.y1 - b.y0)));
  // Index = quarter turns to add so the shoulders end up at the bottom.
  const sides = [
    fill(b.x0, b.y1 - band, b.x1, b.y1), // bottom: already upright
    fill(b.x0, b.y0, b.x0 + band, b.y1), // left: the person's "up" points right
    fill(b.x0, b.y0, b.x1, b.y0 + band), // top: upside down
    fill(b.x1 - band, b.y0, b.x1, b.y1), // right: "up" points left
  ];
  const turns = sides.indexOf(Math.max(...sides));
  if (sides[turns] < 0.75) return null;

  // 2. Straighten using the bottom edge itself: the lowest blob pixel in each
  //    column across the middle of the shoulders lies on a straight line.
  const measure = (angleDeg: number) => {
    const mask = warpAbout(cv, single, blob.cx, blob.cy, angleDeg, size, 0, track);
    const m: Uint8Array = mask.data;
    const bb = maskBounds(mask)!;
    const xs: number[] = [];
    const ys: number[] = [];
    const span = bb.x1 - bb.x0;
    for (let x = Math.round(bb.x0 + span * 0.2); x <= bb.x1 - span * 0.2; x++) {
      for (let y = bb.y1; y >= bb.y1 - span * 0.1; y--) {
        if (m[y * size + x] > 127) { xs.push(x); ys.push(y); break; }
      }
    }
    return { mask, bb, slope: lineSlope(xs, ys) };
  };
  let angleDeg = blob.angleDeg + 90 * turns;
  let fit = measure(angleDeg);
  if (Math.abs(fit.slope) > 0.001 && Math.abs(fit.slope) < 0.1) {
    // A bottom edge sloping down to the right means the photo is turned
    // further clockwise than assumed.
    angleDeg += (Math.atan(fit.slope) * 180) / Math.PI;
    fit = measure(angleDeg);
  }

  // 3. Width from the shoulders; the bottom edge is the blob's lowest row.
  const { x0, x1, y0: headTop, y1: bottom } = fit.bb;
  const width = x1 - x0 + 1;
  const expectedTop = bottom - width / aspect;

  // 4. Search for the top edge between well above the head and just above it.
  const g = warpAbout(cv, gray, blob.cx, blob.cy, angleDeg, size, 255, track);
  const gd: Uint8Array = g.data;
  const lo = Math.max(1, Math.round(bottom - (1.3 * width) / aspect));
  // Stay clear of the head: its blurred edge reaches ~4 px above the eroded silhouette.
  const hi = Math.min(headTop - 6, Math.round(bottom - (0.7 * width) / aspect));
  // Nothing in the photo reaches above its top edge, so the head bounds the fallback.
  let top = Math.min(expectedTop, headTop);
  if (hi - lo > 4) {
    const ca = Math.round(x0 + width * 0.15);
    const cb = Math.round(x1 - width * 0.15);
    const step = new Float32Array(hi - lo + 1);
    for (let y = lo; y <= hi; y++) {
      let sum = 0;
      for (let x = ca; x <= cb; x++) sum += Math.abs(gd[(y + 1) * size + x] - gd[(y - 1) * size + x]);
      step[y - lo] = sum / (cb - ca + 1);
    }
    const sorted = Array.from(step).sort((p, q) => p - q);
    const median = sorted[sorted.length >> 1];
    let peak = 0;
    for (let i = 1; i < step.length; i++) if (step[i] > step[peak]) peak = i;
    if (step[peak] > 1.5 && step[peak] > 3 * median + 0.5) top = lo + peak;
  }

  // Back from the upright canvas into image coordinates.
  const c = rotateVec((x0 + x1) / 2 - size / 2, (top + bottom) / 2 - size / 2, angleDeg);
  return { cx: blob.cx + c.x, cy: blob.cy + c.y, width, height: bottom - top, angleDeg: wrapAngle(angleDeg) };
}

/** Least-squares slope of y against x, with one pass of outlier rejection. */
function lineSlope(xs: number[], ys: number[]): number {
  const fit = (idx: number[]) => {
    const n = idx.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const i of idx) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    const den = n * sxx - sx * sx;
    const slope = den ? (n * sxy - sx * sy) / den : 0;
    return { slope, icpt: (sy - slope * sx) / n };
  };
  if (xs.length < 5) return 0;
  const all = xs.map((_, i) => i);
  const first = fit(all);
  const kept = all.filter((i) => Math.abs(ys[i] - (first.slope * xs[i] + first.icpt)) <= 2);
  return kept.length >= 5 ? fit(kept).slope : first.slope;
}

/**
 * Scan mode: every sufficiently large, rectangular blob is one photo.
 * `aspect` (width / height) is only used to size white-backdrop photos whose
 * top edge can't be seen.
 */
export function detectScan(cv: CV, image: ImageData, aspect = 35 / 45): ScanResult {
  const track: CV[] = [];
  try {
    const minSide = Math.min(image.width, image.height);
    const masks = buildMasks(cv, image, Math.max(5, Math.round(minSide * 0.012)), track);
    const { solid } = masks;

    const contours = new cv.MatVector(); track.push(contours);
    const hierarchy = new cv.Mat(); track.push(hierarchy);
    cv.findContours(solid, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const imgArea = image.width * image.height;
    const result: ScanResult = { photos: [], blobs: [] };
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const rect = cv.minAreaRect(c);
      const hull = new cv.Mat();
      cv.convexHull(c, hull);
      const hullArea = cv.contourArea(hull);
      hull.delete();
      c.delete();

      const rectArea = rect.size.width * rect.size.height;
      if (rectArea < imgArea * 0.01 || rectArea > imgArea * 0.95) continue;
      const shortSide = Math.min(rect.size.width, rect.size.height);
      const longSide = Math.max(rect.size.width, rect.size.height);

      // A photo's outline fills its bounding rectangle; a person-shaped blob doesn't.
      if (hullArea / rectArea >= 0.85 && shortSide / longSide >= 0.45) {
        result.photos.push({ cx: rect.center.x, cy: rect.center.y, ...normalizeRect(rect.size.width, rect.size.height, rect.angle) });
      } else if (shortSide / longSide >= 0.3) {
        const blob = { cx: rect.center.x, cy: rect.center.y, ...normalizeTilt(rect.size.width, rect.size.height, rect.angle) };
        const photo = photoFromBlob(cv, contours, i, masks, blob, aspect, track);
        if (photo) result.photos.push(photo);
        else result.blobs.push(blob);
      }
    }
    return result;
  } finally {
    track.forEach((m) => m.delete());
  }
}
