import { describe, expect, it } from 'vitest';
import { PRESETS } from '../presets';
import { layoutSheet, SHEETS, sheetDpi } from './printSheet';

const sheet = (id: string) => SHEETS.find((s) => s.id === id)!;
const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

describe('layoutSheet', () => {
  it('fits eight 35 × 45 mm photos on a 4 × 6 in print, turned landscape', () => {
    const l = layoutSheet(sheet('4x6'), preset('35x45'));
    expect(l.landscape).toBe(true);
    expect([l.cols, l.rows]).toEqual([4, 2]);
    expect(l.cells).toHaveLength(8);
  });

  it('fits six 2 × 2 in photos on a 4 × 6 in print, edge to edge', () => {
    const l = layoutSheet(sheet('4x6'), preset('us'));
    expect(l.cells).toHaveLength(6);
    expect(l.cells[0].xMm).toBeCloseTo(0);
  });

  it('keeps the printer margin on A4 paper', () => {
    const l = layoutSheet(sheet('a4'), preset('35x45'));
    expect(l.cells).toHaveLength(32);
    for (const c of l.cells) {
      expect(c.xMm).toBeGreaterThanOrEqual(6);
      expect(c.yMm).toBeGreaterThanOrEqual(6);
      expect(c.xMm + 35).toBeLessThanOrEqual(l.widthMm - 6 + 1e-6);
      expect(c.yMm + 45).toBeLessThanOrEqual(l.heightMm - 6 + 1e-6);
    }
  });

  it('spreads leftover space evenly so photos never overlap', () => {
    const l = layoutSheet(sheet('4x6'), preset('35x45'));
    const gaps = [l.cells[1].xMm - (l.cells[0].xMm + 35), l.cells[0].xMm];
    expect(gaps[0]).toBeCloseTo(gaps[1]);
    expect(gaps[0]).toBeGreaterThan(0);
  });

  // The same numbers are listed in the README's "Print sheets" table.
  it.each([
    ['4x6', '35x45', 8], ['4x6', 'us', 6],
    ['5x7', '35x45', 10], ['5x7', 'us', 6],
    ['a4', '35x45', 32], ['a4', 'us', 15],
    ['letter', '35x45', 28], ['letter', 'us', 20],
  ])('fits the documented number of photos: %s sheet, %s photo -> %i', (s, p, n) => {
    expect(layoutSheet(sheet(s), preset(p)).cells).toHaveLength(n);
  });

  it('returns no cells when the photo is larger than the sheet', () => {
    expect(layoutSheet(sheet('4x6'), { widthMm: 120, heightMm: 160 }).cells).toHaveLength(0);
  });
});

describe('sheetDpi', () => {
  it('keeps the chosen DPI when the canvas is small enough', () => {
    expect(sheetDpi(layoutSheet(sheet('4x6'), preset('35x45')), 600)).toBe(600);
  });
  it('steps down for sheets too large for mobile browsers', () => {
    expect(sheetDpi(layoutSheet(sheet('4x6'), preset('35x45')), 1200)).toBe(600);
    expect(sheetDpi(layoutSheet(sheet('a4'), preset('35x45')), 600)).toBe(300);
  });
  it('never goes above the requested DPI', () => {
    expect(sheetDpi(layoutSheet(sheet('4x6'), preset('35x45')), 300)).toBe(300);
  });
});
