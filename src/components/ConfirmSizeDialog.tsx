import { useEffect, useRef, type CSSProperties } from 'react';
import { presetAspect } from '../presets';
import type { SizePreset } from '../types';
import { IconAlert, IconArrowRight, IconSparkle } from './Icons';
import { MiniPhoto } from './illustrations';
import './confirm.css';

interface Props {
  from: SizePreset;
  to: SizePreset;
  fromName: string;
  toName: string;
  boxCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks before a photo-size change re-runs detection on top of boxes the user has
 * adjusted by hand. The illustration shows a hand-tuned box losing its handles and
 * snapping to the new shape. Focus starts on the safe choice; Escape cancels.
 */
export function ConfirmSizeDialog({ from, to, fromName, toName, boxCount, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Read through a ref so a new callback identity on each render doesn't re-run the
  // effect below (which would keep pulling focus back to the Cancel button).
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, []);

  // The box keeps its height and changes width, like the boxes in the editor do.
  const h = 92;
  const w = h * presetAspect(from);
  const sx = presetAspect(to) / presetAspect(from);
  const boxes = boxCount === 1 ? 'the box' : `all ${boxCount} boxes`;

  return (
    <div className="confirm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-desc">
        <div className="confirm-art" aria-hidden="true">
          <svg viewBox="0 0 220 124" className="ill">
            <g transform="translate(110 64)">
              <MiniPhoto tone={1} w={58} h={75} />
              <g className="cf-box" style={{ '--sx': sx } as CSSProperties}>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="3" className="cf-rect" vectorEffect="non-scaling-stroke" />
              </g>
              <g className="cf-handles">
                {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => (
                  <rect key={i} x={(dx * w) / 2 - 4} y={(dy * h) / 2 - 4} width="8" height="8" rx="1.5" className="cf-handle" />
                ))}
                <circle cx="0" cy={-h / 2 - 13} r="4.5" className="cf-handle" />
              </g>
              <g transform={`translate(${(w * Math.max(1, sx)) / 2 + 12} ${-h / 2 + 4})`}>
                <g className="cf-spark"><path d="M0 -9l2.2 6.8L9 0l-6.8 2.2L0 9l-2.2-6.8L-9 0l6.8-2.2z" /></g>
              </g>
            </g>
          </svg>
          <span className="confirm-badge"><IconAlert /></span>
        </div>

        <div className="confirm-body">
          <h2 id="confirm-title">Change the size and detect again?</h2>
          <div className="confirm-sizes">
            <span className="chip from">{fromName}</span>
            <IconArrowRight className="chip-arrow" />
            <span className="chip to">{toName}</span>
          </div>
          <p id="confirm-desc">
            You have changed the boxes by hand. A new size runs detection again, which
            replaces {boxes}, so <strong>your adjustments will be lost</strong>.
          </p>
        </div>

        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="ghost" onClick={onCancel}>
            Keep {fromName}
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            <IconSparkle /> Change &amp; re-detect
          </button>
        </div>
      </div>
    </div>
  );
}
