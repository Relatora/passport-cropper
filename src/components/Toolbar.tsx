import type { ReactNode } from 'react';
import { CUSTOM_PRESET_ID, PRESETS, presetPixels } from '../presets';
import type { DetectMode, SizePreset } from '../types';
import { IconDownload, IconFaces, IconPlus, IconRotateLeft, IconRotateRight, IconScan, IconSparkle, IconTrash } from './Icons';

export interface Settings {
  mode: DetectMode;
  presetId: string;
  customW: number;
  customH: number;
  dpi: number;
  orient: boolean;
}

interface Props {
  settings: Settings;
  preset: SizePreset;
  onSettings: (patch: Partial<Settings>) => void;
  hasImage: boolean;
  hasSelection: boolean;
  boxCount: number;
  busy: boolean;
  onDetect: () => void;
  onAddBox: () => void;
  onRotate: (deg: number) => void;
  onDelete: () => void;
  onClear: () => void;
  onDownloadAll: () => void;
}

const MODES: { id: DetectMode; title: string; hint: string; icon: ReactNode }[] = [
  { id: 'scan', title: 'Loose photos (scan)', hint: 'Cut photos on a scanner or table, at any angle.', icon: <IconScan /> },
  { id: 'faces', title: 'Photo with faces', hint: 'An ordinary photo; one crop per face.', icon: <IconFaces /> },
];

const Step = ({ n, children }: { n: number; children: ReactNode }) => (
  <h2><span className="step-num">{n}</span>{children}</h2>
);

const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || 0));

export function Toolbar(p: Props) {
  const { settings: s, preset } = p;
  const px = presetPixels(preset, s.dpi);
  return (
    <aside className="toolbar">
      <section>
        <Step n={1}>What did you upload?</Step>
        <div className="modes" role="radiogroup" aria-label="Picture type">
          {MODES.map((m) => (
            <label key={m.id} className={`mode${s.mode === m.id ? ' active' : ''}`}>
              <input type="radio" name="mode" checked={s.mode === m.id} onChange={() => p.onSettings({ mode: m.id })} />
              <span className="mode-icon" aria-hidden="true">{m.icon}</span>
              <span className="mode-title">{m.title}</span>
              <span className="mode-hint">{m.hint}</span>
            </label>
          ))}
        </div>
        {s.mode !== 'faces' && (
          <label className="check">
            <input type="checkbox" checked={s.orient} onChange={(e) => p.onSettings({ orient: e.target.checked })} />
            Turn photos upright using face detection
          </label>
        )}
      </section>

      <section>
        <Step n={2}>Photo size</Step>
        <select aria-label="Photo size" value={s.presetId} onChange={(e) => p.onSettings({ presetId: e.target.value })}>
          {PRESETS.map((pr) => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
          <option value={CUSTOM_PRESET_ID}>Custom size…</option>
        </select>
        {s.presetId === CUSTOM_PRESET_ID && (
          <div className="row">
            <label>Width mm <input type="number" min={10} max={200} value={s.customW} onChange={(e) => p.onSettings({ customW: num(e.target.value, 10, 200) })} /></label>
            <label>Height mm <input type="number" min={10} max={200} value={s.customH} onChange={(e) => p.onSettings({ customH: num(e.target.value, 10, 200) })} /></label>
          </div>
        )}
        <div className="row">
          <label>Resolution
            <select value={s.dpi} onChange={(e) => p.onSettings({ dpi: Number(e.target.value) })}>
              <option value={300}>300 dpi</option>
              <option value={600}>600 dpi</option>
            </select>
          </label>
          <small>{px.width} × {px.height} px</small>
        </div>
      </section>

      <section>
        <Step n={3}>Detect & adjust</Step>
        <button type="button" className="primary" disabled={!p.hasImage || p.busy} onClick={p.onDetect}>
          <IconSparkle /> {p.busy ? 'Detecting…' : 'Detect photos'}
        </button>
        <div className="btn-row">
          <button type="button" disabled={!p.hasImage} onClick={p.onAddBox}><IconPlus /> Add</button>
          <button type="button" disabled={!p.hasSelection} onClick={() => p.onRotate(-90)} title="Rotate selected box 90° left" aria-label="Rotate selected box 90° left"><IconRotateLeft /> 90°</button>
          <button type="button" disabled={!p.hasSelection} onClick={() => p.onRotate(90)} title="Rotate selected box 90° right" aria-label="Rotate selected box 90° right"><IconRotateRight /> 90°</button>
        </div>
        <div className="btn-row">
          <button type="button" disabled={!p.hasSelection} onClick={p.onDelete}><IconTrash /> Delete box</button>
          <button type="button" disabled={!p.boxCount} onClick={p.onClear}>Clear all</button>
        </div>
        <small>Drag a box to move it, use the corners to resize and the top handle to rotate. The ▲ marks the top of the photo; dashed lines show where the crown, eyes and chin should be.</small>
      </section>

      <section>
        <Step n={4}>Download</Step>
        <button type="button" className="primary" disabled={!p.boxCount || p.busy} onClick={p.onDownloadAll}>
          <IconDownload /> Download all as ZIP ({p.boxCount})
        </button>
      </section>
    </aside>
  );
}
