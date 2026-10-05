import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmSizeDialog } from './components/ConfirmSizeDialog';
import { CropEditor } from './components/CropEditor';
import { HelpWizard } from './components/HelpWizard';
import { IconAlert, IconCheck, IconHelp, IconLock } from './components/Icons';
import { PreviewStrip } from './components/PreviewStrip';
import { PrintSheetPanel } from './components/PrintSheetPanel';
import { Toolbar, type Settings } from './components/Toolbar';
import { UploadDropzone } from './components/UploadDropzone';
import { detect } from './detect';
import { downloadBlob, exportPhoto, exportZip, photoFileName } from './export/zipExport';
import { wrapAngle } from './geometry';
import { CUSTOM_PRESET_ID, PRESETS, makeCustomPreset, presetAspect } from './presets';
import type { CropBox, RawBox, SizePreset } from './types';

interface LoadedImage {
  bitmap: ImageBitmap;
  /** File name without extension, used to name the exported photos. */
  baseName: string;
}

let idCounter = 0;
const withId = (b: RawBox): CropBox => ({ ...b, id: `b${++idCounter}` });

type StatusKind = 'busy' | 'done' | 'info';

/** Remembers that the intro wizard was seen. Storage may be unavailable (private mode). */
const INTRO_KEY = 'passport-cropper:intro-seen';
const introSeen = () => { try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return false; } };
const markIntroSeen = () => { try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* not persisted */ } };

/** The size preset a set of settings describes (one of PRESETS, or the custom size). */
function presetFor(s: Settings): SizePreset {
  return s.presetId === CUSTOM_PRESET_ID ? makeCustomPreset(s.customW, s.customH) : PRESETS.find((p) => p.id === s.presetId)!;
}

/** Short name for a size, e.g. "35 × 45 mm" (preset labels carry a country list in brackets). */
const sizeName = (p: SizePreset) => (p.id === CUSTOM_PRESET_ID ? `${p.widthMm} × ${p.heightMm} mm` : p.label.replace(/\s*\(.*\)$/, ''));

const SIZE_KEYS = ['presetId', 'customW', 'customH'] as const;

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [boxes, setBoxes] = useState<CropBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatusText] = useState('');
  const [statusKind, setStatusKind] = useState<StatusKind>('info');
  const setStatus = useCallback((text: string, kind: StatusKind = 'busy') => { setStatusText(text); setStatusKind(kind); }, []);
  // A link ending in #example opens straight into the example, so skip the intro there.
  const [helpOpen, setHelpOpen] = useState(() => !introSeen() && location.hash !== '#example');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    mode: 'scan', presetId: PRESETS[0].id, customW: 35, customH: 45, dpi: 600, orient: true,
  });

  const preset = useMemo(() => presetFor(settings), [settings.presetId, settings.customW, settings.customH]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  /** True once the user has moved, resized, rotated, added or removed a box since the last detection. */
  const [edited, setEdited] = useState(false);
  /** A size change waiting for the user to confirm that their adjustments may be lost. */
  const [pendingSize, setPendingSize] = useState<Partial<Settings> | null>(null);
  const aspect = presetAspect(preset);

  // A new photo size changes every box's shape: keep each box's height and centre.
  useEffect(() => {
    setBoxes((bs) => bs.map((b) => ({ ...b, width: b.height * aspect })));
  }, [aspect]);

  // Only the most recent detection may update state (e.g. a new upload mid-detection).
  const detectRun = useRef(0);

  const runDetect = useCallback(async (img: LoadedImage, s: Settings) => {
    const run = ++detectRun.current;
    setBusy(true);
    setError('');
    try {
      const found = await detect(img.bitmap, {
        mode: s.mode, preset: presetFor(s), orient: s.orient, onStatus: setStatus,
      });
      if (run !== detectRun.current) return;
      setBoxes(found.map(withId));
      setEdited(false);
      setSelectedId(null);
      if (found.length) setStatus(`Found ${found.length} photo${found.length === 1 ? '' : 's'}. Adjust the boxes if needed, then download.`, 'done');
      else setStatus('Nothing found. Try the other picture type, or add boxes by hand.', 'info');
    } catch (err) {
      if (run !== detectRun.current) return;
      console.error(err);
      setError(`Detection failed: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('', 'info');
    } finally {
      if (run === detectRun.current) setBusy(false);
    }
  }, [setStatus]);

  const loadFile = useCallback(async (file: File, s: Settings) => {
    try {
      // The previous bitmap is left to the garbage collector rather than close()d:
      // Konva or an in-flight detection may still be drawing from it.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const loaded = { bitmap, baseName: file.name.replace(/\.[^.]+$/, '') || 'photo' };
      setImage(loaded);
      setBoxes([]);
      void runDetect(loaded, s);
    } catch {
      setError('Could not read that file. Please use a JPEG or PNG image.');
    }
  }, [runDetect]);

  const onFile = useCallback((file: File) => loadFile(file, settings), [loadFile, settings]);

  /**
   * Settings changes from the toolbar. A new photo size re-runs detection (see the
   * effect below), which replaces the boxes — so if the user has adjusted boxes by
   * hand, the change is held back until they confirm it in a dialog.
   */
  const changeSettings = (patch: Partial<Settings>) => {
    const changesSize = SIZE_KEYS.some((k) => k in patch && patch[k] !== settings[k]);
    if (changesSize && image && edited && boxes.length) {
      setPendingSize(patch);
      return;
    }
    setSettings((s) => ({ ...s, ...patch }));
  };

  const confirmSizeChange = () => {
    if (pendingSize) setSettings((s) => ({ ...s, ...pendingSize }));
    setEdited(false);
    setPendingSize(null);
  };

  // Re-detect when the photo size changes. Typing a custom size changes it on every
  // keystroke, so that case waits for a short pause first.
  const sizeKey = `${settings.presetId}|${settings.customW}|${settings.customH}`;
  const lastSizeKey = useRef(sizeKey);
  useEffect(() => {
    if (sizeKey === lastSizeKey.current) return;
    lastSizeKey.current = sizeKey;
    if (!image) return;
    const delay = settingsRef.current.presetId === CUSTOM_PRESET_ID ? 500 : 0;
    const timer = setTimeout(() => void runDetect(image, settingsRef.current), delay);
    return () => clearTimeout(timer);
  }, [sizeKey, image, runDetect]);

  const closeHelp = () => { setHelpOpen(false); markIntroSeen(); };

  /** Load the bundled example scan (in scan mode) so people can try the app without a photo. */
  const tryExample = async () => {
    closeHelp();
    try {
      const blob = await (await fetch(`${import.meta.env.BASE_URL}demo-scan.png`)).blob();
      const s = { ...settings, mode: 'scan' as const };
      setSettings(s);
      await loadFile(new File([blob], 'example-scan.png', { type: blob.type }), s);
    } catch {
      setError('Could not load the example image.');
    }
  };

  // Shareable demo link: …/passport-cropper/#example loads the example scan on arrival.
  const exampleRequested = useRef(location.hash === '#example');
  useEffect(() => {
    if (!exampleRequested.current) return;
    exampleRequested.current = false;
    void tryExample();
  });

  const updateBox = (box: CropBox) => {
    setBoxes((bs) => bs.map((b) => (b.id === box.id ? box : b)));
    setEdited(true);
  };

  const addBox = () => {
    if (!image) return;
    const height = image.bitmap.height * 0.3;
    const box = withId({ cx: image.bitmap.width / 2, cy: image.bitmap.height / 2, height, width: height * aspect, angleDeg: 0 });
    setBoxes((bs) => [...bs, box]);
    setSelectedId(box.id);
    setEdited(true);
  };

  const rotateSelected = (deg: number) => {
    setBoxes((bs) => bs.map((b) => (b.id === selectedId ? { ...b, angleDeg: wrapAngle(b.angleDeg + deg) } : b)));
    setEdited(true);
  };

  const deleteSelected = useCallback(() => {
    setBoxes((bs) => bs.filter((b) => b.id !== selectedId));
    setSelectedId(null);
    setEdited(true);
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId || (e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, deleteSelected]);

  const downloadOne = async (i: number) => {
    if (!image) return;
    downloadBlob(await exportPhoto(image.bitmap, boxes[i], preset, settings.dpi), photoFileName(image.baseName, i, preset));
  };

  const downloadAll = async () => {
    if (!image) return;
    setBusy(true);
    setStatus('Preparing ZIP…', 'busy');
    try {
      downloadBlob(await exportZip(image.bitmap, boxes, preset, settings.dpi, image.baseName), `${image.baseName}-passport-photos.zip`);
      setStatus(`Downloaded ${boxes.length} photo${boxes.length === 1 ? '' : 's'}.`, 'done');
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true"><span /><span /><span /></div>
      <header className="hero">
        <div className="logo" aria-hidden="true">
          {/* Same artwork as the tab icon (public/favicon.svg), on the gradient tile. */}
          <svg viewBox="6 6 52 52">
            <g transform="rotate(-9 32 32)">
              <rect x="19.5" y="14" width="25" height="33" rx="3" fill="#fff" />
              <circle cx="32" cy="26.5" r="5.8" fill="#a855f7" />
              <path d="M22.5 47c1.4-6.6 5-9.8 9.5-9.8s8.1 3.2 9.5 9.8z" fill="#6366f1" />
            </g>
            <path d="M11 21V11h10M43 11h10v10M53 43v10H43M21 53H11V43" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="hero-text">
          <h1>Passport Photo Cropper</h1>
          <p>Scan several passport photos at once. Each one is found, straightened and cropped to the size you need.</p>
        </div>
        <div className="hero-actions">
          <span className="privacy-pill"><IconLock /> Nothing is uploaded</span>
          <button type="button" className="help-btn" onClick={() => setHelpOpen(true)}>
            <IconHelp /> How it works
          </button>
        </div>
      </header>
      <div className="layout">
        <Toolbar
          settings={settings}
          preset={preset}
          onSettings={changeSettings}
          hasImage={!!image}
          hasSelection={!!selectedId}
          boxCount={boxes.length}
          busy={busy}
          onDetect={() => image && runDetect(image, settings)}
          onAddBox={addBox}
          onRotate={rotateSelected}
          onDelete={deleteSelected}
          onClear={() => { setBoxes([]); setSelectedId(null); setEdited(true); }}
          onDownloadAll={downloadAll}
          onPrintSheet={() => document.getElementById('print-sheet')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
        <main>
          {(status || error) && (
            <div className={`status ${error ? 'error' : statusKind}`} role="status" key={error || status}>
              {error ? <IconAlert /> : statusKind === 'busy' ? <span className="spinner" aria-hidden="true" /> : statusKind === 'done' ? <IconCheck /> : null}
              <span>{error || status}</span>
            </div>
          )}
          {image ? (
            <>
              <div className={`editor-wrap${busy ? ' scanning' : ''}`}>
                <CropEditor image={image.bitmap} boxes={boxes} preset={preset} selectedId={selectedId} onSelect={setSelectedId} onChange={updateBox} />
              </div>
              <PreviewStrip image={image.bitmap} boxes={boxes} selectedId={selectedId} onSelect={setSelectedId} onDownload={downloadOne} />
              {boxes.length > 0 && (
                <PrintSheetPanel image={image.bitmap} boxes={boxes} preset={preset} sizeName={sizeName(preset)} dpi={settings.dpi} baseName={image.baseName} />
              )}
              <UploadDropzone onFile={onFile} compact />
            </>
          ) : (
            <UploadDropzone onFile={onFile} onTryExample={tryExample} />
          )}
        </main>
      </div>
      <HelpWizard open={helpOpen} onClose={closeHelp} onTryExample={tryExample} />
      {pendingSize && (
        <ConfirmSizeDialog
          from={preset}
          to={presetFor({ ...settings, ...pendingSize })}
          fromName={sizeName(preset)}
          toName={sizeName(presetFor({ ...settings, ...pendingSize }))}
          boxCount={boxes.length}
          onConfirm={confirmSizeChange}
          onCancel={() => setPendingSize(null)}
        />
      )}
    </div>
  );
}
