/// <reference lib="webworker" />
/**
 * OpenCV.js runs here, off the main thread: the 13 MB WASM build takes a moment
 * to initialise and contour work on a large scan would otherwise freeze the UI.
 */
import cvModule from '@techstark/opencv-js';
import type { RawBox } from '../types';
import { detectGrid, detectScan, type CV } from './cvDetect';

export type CvRequest =
  | { id: number; kind: 'scan'; image: ImageData; aspect: number }
  | { id: number; kind: 'grid'; image: ImageData; rows: number; cols: number; aspect: number };

export type CvResponse = { id: number; boxes: RawBox[]; blobs: RawBox[] } | { id: number; error: string };

let cvReady: Promise<CV> | null = null;

/** Resolve the OpenCV module regardless of which init style this build uses. */
function getCv(): Promise<CV> {
  cvReady ??= (async () => {
    const m = cvModule as CV;
    if (m instanceof Promise) return await m;
    if (m.Mat) return m;
    await new Promise<void>((resolve) => { m.onRuntimeInitialized = () => resolve(); });
    return m;
  })();
  return cvReady;
}

self.onmessage = async (e: MessageEvent<CvRequest>) => {
  const req = e.data;
  try {
    const cv = await getCv();
    if (req.kind === 'scan') {
      const { photos, blobs } = detectScan(cv, req.image, req.aspect);
      self.postMessage({ id: req.id, boxes: photos, blobs } satisfies CvResponse);
    } else {
      self.postMessage({ id: req.id, boxes: detectGrid(cv, req.image, req.rows, req.cols, req.aspect), blobs: [] } satisfies CvResponse);
    }
  } catch (err) {
    self.postMessage({ id: req.id, error: err instanceof Error ? err.message : String(err) } satisfies CvResponse);
  }
};
