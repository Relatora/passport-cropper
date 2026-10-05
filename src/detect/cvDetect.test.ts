/**
 * Integration tests for the OpenCV detectors. Scenes are drawn with OpenCV
 * itself, so no image fixtures are needed: tilted "photos" on a scanner bed.
 */
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { boxCorners, readingOrder, rotateVec, wrapAngle } from '../geometry';
import { detectScan, type CV } from './cvDetect';

const require = createRequire(import.meta.url);
let cv: CV;

beforeAll(async () => {
  const m = require('@techstark/opencv-js');
  if (m instanceof Promise) cv = await m;
  else if (m.Mat) cv = m;
  else cv = await new Promise((resolve) => { m.onRuntimeInitialized = () => resolve(m); });
}, 60_000);

interface Shape { cx: number; cy: number; width: number; height: number; angleDeg: number }

/** Draw a fake passport photo: light backdrop, darker head and shoulders. */
function drawPhoto(img: CV, s: Shape) {
  const poly = (b: Shape, color: number[]) => {
    const pts = boxCorners(b).flatMap((p) => [Math.round(p.x), Math.round(p.y)]);
    const mat = cv.matFromArray(4, 1, cv.CV_32SC2, pts);
    const vec = new cv.MatVector();
    vec.push_back(mat);
    cv.fillPoly(img, vec, new cv.Scalar(...color));
    vec.delete(); mat.delete();
  };
  poly(s, [226, 232, 240, 255]);
  // A "head" in the upper half, in the photo's own rotated frame.
  const a = (s.angleDeg * Math.PI) / 180;
  const off = -s.height * 0.12;
  poly({ ...s, cx: s.cx - off * Math.sin(a), cy: s.cy + off * Math.cos(a), width: s.width * 0.4, height: s.height * 0.4 }, [200, 160, 140, 255]);
}

function scene(w: number, h: number, bg: number[], photos: Shape[]): ImageData {
  const img = new cv.Mat(h, w, cv.CV_8UC4, new cv.Scalar(...bg));
  photos.forEach((p) => drawPhoto(img, p));
  const data = { data: new Uint8ClampedArray(img.data), width: w, height: h } as unknown as ImageData;
  img.delete();
  return data;
}

describe('detectScan', () => {
  it('finds tilted photos on a scanner bed with their rotation', () => {
    const photos: Shape[] = [
      { cx: 250, cy: 300, width: 280, height: 360, angleDeg: -7 },
      { cx: 700, cy: 300, width: 280, height: 360, angleDeg: 11 },
      { cx: 1150, cy: 310, width: 280, height: 360, angleDeg: 2 },
    ];
    const found = readingOrder(detectScan(cv, scene(1400, 650, [247, 247, 245, 255], photos)).photos, 100);
    expect(found).toHaveLength(3);
    found.forEach((b, i) => {
      expect(b.cx).toBeCloseTo(photos[i].cx, -1);
      expect(b.cy).toBeCloseTo(photos[i].cy, -1);
      expect(Math.abs(b.angleDeg - photos[i].angleDeg)).toBeLessThan(1.5);
      expect(b.height).toBeGreaterThan(b.width);
    });
  });

  it('reports a sideways photo as a portrait box turned ~90°', () => {
    const found = detectScan(cv, scene(800, 600, [247, 247, 245, 255], [{ cx: 400, cy: 300, width: 280, height: 360, angleDeg: 93 }])).photos;
    expect(found).toHaveLength(1);
    expect(Math.abs(Math.abs(found[0].angleDeg) - 93)).toBeLessThan(1.5);
  });
  it('reports a white-backdrop photo with no visible edge as a tilted blob', () => {
    // Only the person stands out: a head on top of shoulders cut by the photo's straight bottom edge.
    const img = new cv.Mat(600, 800, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
    const tilt = 4;
    const at = (ux: number, uy: number) => {
      const a = (tilt * Math.PI) / 180;
      return [Math.round(400 + ux * Math.cos(a) - uy * Math.sin(a)), Math.round(300 + ux * Math.sin(a) + uy * Math.cos(a))];
    };
    // Shoulders: a half-ellipse whose flat side is the photo's bottom edge.
    const shoulder: number[] = [];
    for (let t = 0; t <= 180; t += 5) shoulder.push(...at(130 * Math.cos((t * Math.PI) / 180), 150 - 90 * Math.sin((t * Math.PI) / 180)));
    const mat = cv.matFromArray(shoulder.length / 2, 1, cv.CV_32SC2, shoulder);
    const vec = new cv.MatVector();
    vec.push_back(mat);
    cv.fillPoly(img, vec, new cv.Scalar(40, 50, 90, 255));
    const [hx, hy] = at(0, -10);
    cv.ellipse(img, new cv.Point(hx, hy), new cv.Size(55, 75), tilt, 0, 360, new cv.Scalar(200, 160, 140, 255), -1);
    const data = { data: new Uint8ClampedArray(img.data), width: 800, height: 600 } as unknown as ImageData;
    vec.delete(); mat.delete(); img.delete();

    // The blob is rebuilt into the photo: width from the shoulders, bottom on the
    // straight cut, height from the aspect ratio since no top edge is visible.
    const { photos, blobs } = detectScan(cv, data, 35 / 45);
    expect(blobs).toHaveLength(0);
    expect(photos).toHaveLength(1);
    const p = photos[0];
    expect(Math.abs(p.angleDeg - tilt)).toBeLessThan(1);
    expect(p.width).toBeCloseTo(260, -1);
    expect(p.height).toBeCloseTo(260 / (35 / 45), -1);
    const bottom = rotateVec(0, p.height / 2, p.angleDeg);
    const [bx, by] = at(0, 150);
    expect(Math.hypot(p.cx + bottom.x - bx, p.cy + bottom.y - by)).toBeLessThan(5);
  });

  /**
   * A real white-backdrop passport photo on a white scanner: the backdrop is a
   * shade off the bed colour (invisible to the detector), only the paper's top
   * edge shows as a faint line, and the shoulders run into both sides of the photo.
   */
  function whiteOnWhite(photos: Shape[]): ImageData {
    const img = new cv.Mat(900, 1400, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
    for (const s of photos) {
      const at = (ux: number, uy: number) => {
        const r = rotateVec(ux * s.width, uy * s.height, s.angleDeg);
        return [Math.round(s.cx + r.x), Math.round(s.cy + r.y)];
      };
      const fill = (pts: number[][], color: number[]) => {
        const mat = cv.matFromArray(pts.length, 1, cv.CV_32SC2, pts.flat());
        const vec = new cv.MatVector();
        vec.push_back(mat);
        cv.fillPoly(img, vec, new cv.Scalar(...color, 255));
        vec.delete(); mat.delete();
      };
      fill([at(-0.5, -0.5), at(0.5, -0.5), at(0.5, 0.5), at(-0.5, 0.5)], [252, 252, 251]);
      // Faint top edge of the paper, nothing along the sides.
      const [ax, ay] = at(-0.5, -0.5);
      const [bx, by] = at(0.5, -0.5);
      cv.line(img, new cv.Point(ax, ay), new cv.Point(bx, by), new cv.Scalar(222, 222, 222, 255), 1);
      // Shoulders: full width at the bottom, rising along the sides, curving to the neck.
      const shoulders = [at(-0.5, 0.5), at(-0.5, 0.3), at(-0.4, 0.2), at(-0.15, 0.13), at(0.15, 0.13), at(0.4, 0.2), at(0.5, 0.3), at(0.5, 0.5)];
      fill(shoulders, [30, 35, 60]);
      const [hx, hy] = at(0, -0.12);
      cv.ellipse(img, new cv.Point(hx, hy), new cv.Size(Math.round(s.width * 0.26), Math.round(s.height * 0.3)), s.angleDeg, 0, 360, new cv.Scalar(70, 50, 40, 255), -1);
      cv.ellipse(img, new cv.Point(...at(0, -0.06)), new cv.Size(Math.round(s.width * 0.21), Math.round(s.height * 0.24)), s.angleDeg, 0, 360, new cv.Scalar(225, 185, 160, 255), -1);
    }
    const data = { data: new Uint8ClampedArray(img.data), width: img.cols, height: img.rows } as unknown as ImageData;
    img.delete();
    return data;
  }

  it('rebuilds white-on-white photos from the silhouette and the faint top edge', () => {
    const truth: Shape[] = [
      { cx: 250, cy: 250, width: 280, height: 360, angleDeg: 3 },
      { cx: 700, cy: 260, width: 280, height: 360, angleDeg: -6 },
      { cx: 1150, cy: 250, width: 280, height: 360, angleDeg: 1.5 },
      { cx: 450, cy: 680, width: 300, height: 385, angleDeg: 182 },
    ];
    const { photos, blobs } = detectScan(cv, whiteOnWhite(truth), 35 / 45);
    expect(blobs).toHaveLength(0);
    const found = readingOrder(photos, 150);
    expect(found).toHaveLength(truth.length);
    found.forEach((b, i) => {
      const t = truth[i];
      expect(Math.hypot(b.cx - t.cx, b.cy - t.cy)).toBeLessThan(6);
      expect(Math.abs(b.width - t.width)).toBeLessThan(6);
      expect(Math.abs(b.height - t.height)).toBeLessThan(6);
      // The angle includes which way is up, so no modulo here.
      expect(Math.abs(wrapAngle(b.angleDeg - t.angleDeg))).toBeLessThan(0.75);
    });
  });
});
