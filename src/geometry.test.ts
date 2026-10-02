import { describe, expect, it } from 'vitest';
import { autoGridCounts, boxCorners, chooseAxisSegments, findSegments, fitAspectInside, normalizeRect, wrapAngle } from './geometry';
import { PRESETS, presetPixels } from './presets';
import { readJpegDpi, setJpegDpi } from './export/jfifDpi';

describe('normalizeRect', () => {
  it('turns OpenCV 4.5+ style angles into a small portrait tilt', () => {
    // What OpenCV.js returns for a 100×200 rect tilted 20° clockwise.
    expect(normalizeRect(200, 100, -70)).toEqual({ width: 100, height: 200, angleDeg: 20 });
  });
  it('handles the older (-90, 0] convention', () => {
    expect(normalizeRect(100, 200, -10)).toEqual({ width: 100, height: 200, angleDeg: -10 });
  });
  it('turns a landscape (sideways) photo into a portrait box rotated 90°', () => {
    expect(normalizeRect(200, 100, 5)).toEqual({ width: 100, height: 200, angleDeg: 95 });
  });
  it('keeps squares as they are', () => {
    expect(normalizeRect(100, 102, 90)).toEqual({ width: 102, height: 100, angleDeg: 0 });
  });
});

describe('wrapAngle', () => {
  it('wraps into (-180, 180]', () => {
    expect(wrapAngle(270)).toBe(-90);
    expect(wrapAngle(-180)).toBe(180);
    expect(wrapAngle(45)).toBe(45);
  });
});

describe('fitAspectInside', () => {
  it('fits a portrait aspect inside a wider rectangle', () => {
    const r = fitAspectInside(100, 90, 35 / 45);
    expect(r.height).toBeCloseTo(90);
    expect(r.width).toBeCloseTo(70);
  });
  it('fits inside a taller rectangle and applies the inset', () => {
    const r = fitAspectInside(70, 200, 35 / 45, 0.1);
    expect(r.width).toBeCloseTo(63);
    expect(r.height).toBeCloseTo(81);
  });
});

describe('boxCorners', () => {
  it('rotates corners clockwise in image space', () => {
    const [tl] = boxCorners({ cx: 0, cy: 0, width: 2, height: 2, angleDeg: 90 });
    // Top-left (-1,-1) rotated 90° clockwise (y down) ends up at top-right (1,-1).
    expect(tl.x).toBeCloseTo(1);
    expect(tl.y).toBeCloseTo(-1);
  });
});

describe('presetPixels', () => {
  it('converts mm to pixels at the requested DPI', () => {
    expect(presetPixels(PRESETS[0], 300)).toEqual({ width: 413, height: 531 });
    expect(presetPixels(PRESETS[1], 300)).toEqual({ width: 600, height: 600 });
  });
});

describe('findSegments', () => {
  const profile = (spec: string) => [...spec].map((c) => (c === '#' ? 10 : 0));
  it('splits content runs at wide enough gutters', () => {
    expect(findSegments(profile('####..####..####'), 5, 2, 2)).toEqual([[0, 4], [6, 10], [12, 16]]);
  });
  it('ignores gaps narrower than minGap', () => {
    expect(findSegments(profile('###.###..###'), 5, 2, 2)).toEqual([[0, 7], [9, 12]]);
  });
  it('drops runs shorter than minRun', () => {
    expect(findSegments(profile('#...######'), 5, 2, 3)).toEqual([[4, 10]]);
  });
});

describe('chooseAxisSegments', () => {
  it('uses detected gutters when they match the expected count', () => {
    expect(chooseAxisSegments([[0, 48], [52, 100]], 100, 2, 0)).toEqual([[0, 48], [52, 100]]);
  });
  it('falls back to an even split when the count is wrong', () => {
    expect(chooseAxisSegments([[0, 100]], 100, 2, 0)).toEqual([[0, 50], [50, 100]]);
  });
  it('in auto mode, rejects uneven gutters (e.g. a white band inside a photo)', () => {
    expect(chooseAxisSegments([[0, 20], [25, 100]], 100, 0, 2)).toEqual([[0, 50], [50, 100]]);
  });
});

describe('autoGridCounts', () => {
  it('derives the missing axis from cell aspect', () => {
    // Two 35×45 columns side by side, three rows tall.
    expect(autoGridCounts(70, 135, 35 / 45, 2, 0)).toEqual({ rows: 3, cols: 2 });
  });
  it('picks the smallest plausible grid without hints', () => {
    expect(autoGridCounts(70, 45, 35 / 45, 0, 0)).toEqual({ rows: 1, cols: 2 });
  });
});

describe('JFIF DPI', () => {
  const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0, 0, 0xff, 0xd9]);
  it('patches an existing JFIF header', () => {
    const out = setJpegDpi(jfif, 300);
    expect(out.length).toBe(jfif.length);
    expect(readJpegDpi(out)).toBe(300);
  });
  it('inserts a JFIF header when missing', () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
    const out = setJpegDpi(bare, 600);
    expect(readJpegDpi(out)).toBe(600);
    expect([...out.slice(-6)]).toEqual([...bare.slice(2)]);
  });
});
