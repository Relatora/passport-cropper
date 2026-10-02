import type { SizePreset } from './types';

/**
 * Common passport/visa photo sizes. Head size (chin to crown) and the margin
 * above the head are mid-range values from the respective official specs, so
 * automatic face framing lands comfortably inside the allowed tolerances.
 */
export const PRESETS: SizePreset[] = [
  { id: '35x45', label: '35 × 45 mm (UK, EU, Schengen, India, Australia)', widthMm: 35, heightMm: 45, headRatio: 0.74, topMargin: 0.09 },
  { id: 'us', label: '2 × 2 in (US passport & visa)', widthMm: 50.8, heightMm: 50.8, headRatio: 0.6, topMargin: 0.1 },
  { id: '33x48', label: '33 × 48 mm (China visa)', widthMm: 33, heightMm: 48, headRatio: 0.64, topMargin: 0.08 },
  { id: '35x35', label: '35 × 35 mm (Indonesia, Malaysia)', widthMm: 35, heightMm: 35, headRatio: 0.7, topMargin: 0.1 },
  { id: '50x70', label: '50 × 70 mm (Canada)', widthMm: 50, heightMm: 70, headRatio: 0.48, topMargin: 0.12 },
];

export const CUSTOM_PRESET_ID = 'custom';

/** Eye line as a fraction of head height, measured down from the crown (hair included). */
export const EYE_LEVEL_IN_HEAD = 0.5;

/** Crown, eye line and chin as fractions of photo height from the top edge. */
export function headGuides(p: SizePreset): { crown: number; eyes: number; chin: number } {
  const crown = p.topMargin;
  return { crown, eyes: crown + EYE_LEVEL_IN_HEAD * p.headRatio, chin: crown + p.headRatio };
}

export function makeCustomPreset(widthMm: number, heightMm: number): SizePreset {
  return { id: CUSTOM_PRESET_ID, label: 'Custom', widthMm, heightMm, headRatio: 0.72, topMargin: 0.1 };
}

/** Width / height of the finished photo. */
export function presetAspect(p: SizePreset): number {
  return p.widthMm / p.heightMm;
}

/** Output pixel dimensions for a preset at a given print resolution. */
export function presetPixels(p: SizePreset, dpi: number): { width: number; height: number } {
  return {
    width: Math.round((p.widthMm / 25.4) * dpi),
    height: Math.round((p.heightMm / 25.4) * dpi),
  };
}
