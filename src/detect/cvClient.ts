/**
 * Promise-based wrapper around the OpenCV worker. The worker (and the 13 MB
 * OpenCV build inside it) is only started the first time a detector needs it.
 */
import type { RawBox } from '../types';
import type { CvRequest, CvResponse } from './cv.worker';

export interface CvResult { boxes: RawBox[]; blobs: RawBox[] }

type Pending = { resolve: (r: CvResult) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./cv.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<CvResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if ('error' in e.data) p.reject(new Error(e.data.error));
      else p.resolve({ boxes: e.data.boxes, blobs: e.data.blobs });
    };
    worker.onerror = (e) => {
      pending.forEach((p) => p.reject(new Error(e.message || 'OpenCV worker crashed')));
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

export function runCv(req: WithoutId<CvRequest>): Promise<CvResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id });
  });
}
