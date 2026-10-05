/**
 * A rotated crop rectangle in *source-image pixel* coordinates.
 *
 * (cx, cy) is the centre, width/height are the box's own (unrotated) sides and
 * angleDeg is a clockwise rotation in image space (y axis pointing down) — the
 * same convention used by OpenCV's RotatedRect and by Konva's `rotation`.
 * The box's "top" edge is the top of the exported photo.
 */
export interface CropBox {
  id: string;
  cx: number;
  cy: number;
  width: number;
  height: number;
  angleDeg: number;
}

/** What kind of picture the user uploaded; selects the detection algorithm. */
export type DetectMode = 'scan' | 'faces';

export interface SizePreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  /** Head height (chin to crown) as a fraction of photo height. Used by face framing. */
  headRatio: number;
  /** Space between the top of the photo and the crown, as a fraction of photo height. */
  topMargin: number;
}

/** Plain-object version of a box, as produced by the detectors before ids are assigned. */
export type RawBox = Omit<CropBox, 'id'>;
