/**
 * Face detection (MediaPipe BlazeFace) and everything built on it:
 *  - detectFaceBoxes: "Faces" mode — frame a passport crop around every face.
 *  - autoOrient: fix photos that lie sideways or upside down in scan mode.
 */
import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision';
import { iou, pointInBox, rotateVec } from '../geometry';
import { headGuides, presetAspect } from '../presets';
import { renderCrop } from '../export/renderCrop';
import type { RawBox, SizePreset } from '../types';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/**
 * Head height (chin to crown, hair included) relative to the distance between
 * BlazeFace's eye and mouth keypoints. The detector doesn't see the top of the
 * head, so we extrapolate from features it locates reliably. Measured on real
 * passport photos: the mouth keypoint sits above the lips, hence the ratio is
 * larger than anatomical tables suggest.
 */
const HEAD_PER_EYE_MOUTH = 4.1;

export interface Face {
  /** Axis-aligned bounding box in source pixels. */
  x: number; y: number; w: number; h: number;
  score: number;
  /** Image-left eye, image-right eye, mouth centre (source pixels). */
  eyeA: { x: number; y: number };
  eyeB: { x: number; y: number };
  mouth: { x: number; y: number };
}

let detectorPromise: Promise<FaceDetector> | null = null;

function getDetector(): Promise<FaceDetector> {
  detectorPromise ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe`);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    });
  })();
  detectorPromise.catch(() => { detectorPromise = null; });
  return detectorPromise;
}

/** Convert a MediaPipe detection on a tile into a Face in source coordinates. */
function toFace(d: Detection, ox: number, oy: number, sx: number, sy: number, tileW: number, tileH: number): Face | null {
  const bb = d.boundingBox;
  const kp = d.keypoints;
  if (!bb || kp.length < 4) return null;
  const pt = (i: number) => ({ x: ox + kp[i].x * tileW * sx, y: oy + kp[i].y * tileH * sy });
  return {
    x: ox + bb.originX * sx, y: oy + bb.originY * sy, w: bb.width * sx, h: bb.height * sy,
    score: d.categories[0]?.score ?? 0,
    eyeA: pt(0), eyeB: pt(1), mouth: pt(3),
  };
}

/**
 * BlazeFace short-range looks at a 128 px version of its input, so small faces
 * in a group photo vanish. We therefore also run it on overlapping tiles (halves
 * and thirds of the image), discard detections cut by a tile edge, and merge the
 * rest with non-maximum suppression.
 */
export async function detectFaces(source: CanvasImageSource & { width: number; height: number }, tiled = true): Promise<Face[]> {
  const detector = await getDetector();
  const W = source.width;
  const H = source.height;
  const tiles: { x: number; y: number; w: number; h: number }[] = [{ x: 0, y: 0, w: W, h: H }];
  if (tiled) {
    for (const f of [1 / 2, 1 / 3]) {
      const tw = W * f;
      const th = H * f;
      for (let ty = 0; ty + th <= H + 1; ty += th / 2) {
        for (let tx = 0; tx + tw <= W + 1; tx += tw / 2) tiles.push({ x: tx, y: ty, w: tw, h: th });
      }
    }
  }

  const all: Face[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  for (const t of tiles) {
    // Cap the tile canvas size: the model downsamples to 128 px anyway.
    const scale = Math.min(1, 1024 / Math.max(t.w, t.h));
    canvas.width = Math.round(t.w * scale);
    canvas.height = Math.round(t.h * scale);
    ctx.drawImage(source, t.x, t.y, t.w, t.h, 0, 0, canvas.width, canvas.height);
    const result = detector.detect(canvas);
    const sx = t.w / canvas.width;
    const sy = t.h / canvas.height;
    for (const d of result.detections) {
      const face = toFace(d, t.x, t.y, sx, sy, canvas.width, canvas.height);
      if (!face) continue;
      const margin = 0.01 * Math.max(t.w, t.h);
      const cut =
        (t.x > 0 && face.x < t.x + margin) || (t.y > 0 && face.y < t.y + margin) ||
        (t.x + t.w < W - 1 && face.x + face.w > t.x + t.w - margin) ||
        (t.y + t.h < H - 1 && face.y + face.h > t.y + t.h - margin);
      if (!cut) all.push(face);
    }
  }

  all.sort((a, b) => b.score - a.score);
  const kept: Face[] = [];
  for (const f of all) {
    if (kept.every((k) => iou(k, f) < 0.3)) kept.push(f);
  }
  return kept;
}

/**
 * Build a passport crop around a face: rotation from the eye line, head size
 * from the eye-to-mouth distance, then size and position the box so the head
 * fills the preset's head ratio with the preset's margin above the crown.
 */
export function frameFace(face: Face, preset: SizePreset): RawBox {
  const angleDeg = (Math.atan2(face.eyeB.y - face.eyeA.y, face.eyeB.x - face.eyeA.x) * 180) / Math.PI;
  const eyeMid = { x: (face.eyeA.x + face.eyeB.x) / 2, y: (face.eyeA.y + face.eyeB.y) / 2 };
  const down = rotateVec(0, 1, angleDeg);
  const eyeToMouth = Math.max(1, (face.mouth.x - eyeMid.x) * down.x + (face.mouth.y - eyeMid.y) * down.y);
  const head = HEAD_PER_EYE_MOUTH * eyeToMouth;
  const height = head / preset.headRatio;
  const width = height * presetAspect(preset);
  // Box centre relative to the eyes, measured along the face's "down" direction.
  const eyesFromTop = headGuides(preset).eyes * height;
  const shift = height / 2 - eyesFromTop;
  return { cx: eyeMid.x + down.x * shift, cy: eyeMid.y + down.y * shift, width, height, angleDeg };
}

/** "Faces" mode: one passport crop per detected face, in reading order. */
export async function detectFaceBoxes(source: CanvasImageSource & { width: number; height: number }, preset: SizePreset): Promise<RawBox[]> {
  const faces = await detectFaces(source);
  return faces
    .sort((a, b) => Math.round(a.y / (a.h * 1.5)) - Math.round(b.y / (b.h * 1.5)) || a.x - b.x)
    .map((f) => frameFace(f, preset));
}

/**
 * Scan-mode fallback for photos whose paper edge is invisible (white backdrop on
 * a white scanner): each such photo shows up as a person-shaped blob. Frame a
 * passport crop around the main face in every blob, taking the tilt from the
 * blob's rectangle (aligned with the straight bottom edge of the photo) when it
 * agrees with the eye line, since that is steadier than two eye keypoints.
 *
 * Faces inside an already-detected photo are skipped, and within one blob only
 * the large faces are kept, so a face printed on a T-shirt doesn't become a photo.
 */
export async function frameFacesInBlobs(
  source: CanvasImageSource & { width: number; height: number },
  blobs: RawBox[],
  photos: RawBox[],
  preset: SizePreset,
): Promise<RawBox[]> {
  const faces = await detectFaces(source);
  const byBlob = new Map<RawBox, Face[]>();
  for (const f of faces) {
    const fx = f.x + f.w / 2;
    const fy = f.y + f.h / 2;
    if (photos.some((p) => pointInBox(fx, fy, p))) continue;
    const blob = blobs.find((b) => pointInBox(fx, fy, b));
    if (blob) byBlob.set(blob, [...(byBlob.get(blob) ?? []), f]);
  }

  const boxes: RawBox[] = [];
  for (const [blob, blobFaces] of byBlob) {
    const largest = Math.max(...blobFaces.map((f) => f.w));
    for (const f of blobFaces.filter((f) => f.w >= largest * 0.6)) {
      const box = frameFace(f, preset);
      // Compare modulo 90°: the blob rectangle doesn't know which side is up.
      const d = ((((blob.angleDeg - box.angleDeg) % 90) + 135) % 90) - 45;
      if (Math.abs(d) < 8) box.angleDeg += d;
      boxes.push(box);
    }
  }
  return boxes;
}

/**
 * Try a box upright and upside down (plus sideways, for square boxes whose
 * footprint survives a quarter turn) and keep the rotation where the face
 * detector is most confident. Boxes with no detectable face are unchanged.
 */
export async function autoOrient(source: CanvasImageSource, box: RawBox): Promise<RawBox> {
  let best = { score: 0, turn: 0 };
  const outH = 320;
  const outW = (outH * box.width) / box.height;
  const square = Math.abs(box.width / box.height - 1) < 0.1;
  for (const turn of square ? [0, 90, 180, 270] : [0, 180]) {
    const canvas = renderCrop(source, { ...box, angleDeg: box.angleDeg + turn }, outW, outH);
    const faces = await detectFaces(canvas, false);
    const score = faces[0]?.score ?? 0;
    if (score > best.score + 0.02) best = { score, turn };
  }
  return { ...box, angleDeg: box.angleDeg + best.turn };
}
