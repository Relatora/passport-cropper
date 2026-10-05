import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CropEditor } from './components/CropEditor';
import { HelpWizard } from './components/HelpWizard';
import { IconAlert, IconCheck, IconHelp, IconLock } from './components/Icons';
import { PreviewStrip } from './components/PreviewStrip';
import { Toolbar, type Settings } from './components/Toolbar';
import { UploadDropzone } from './components/UploadDropzone';
import { detect } from './detect';
import { downloadBlob, exportPhoto, exportZip, photoFileName } from './export/zipExport';
import { wrapAngle } from './geometry';
import { CUSTOM_PRESET_ID, PRESETS, makeCustomPreset, presetAspect } from './presets';
import type { CropBox, RawBox } from './types';

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
    mode: 'scan', presetId: PRESETS[0].id, customW: 35, customH: 45, dpi: 300, orient: true,
  });

  const preset = useMemo(
    () => (settings.presetId === CUSTOM_PRESET_ID
      ? makeCustomPreset(settings.customW, settings.customH)
      : PRESETS.find((p) => p.id === settings.presetId)!),
    [settings.presetId, settings.customW, settings.customH],
  );
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
        mode: s.mode, preset, orient: s.orient, onStatus: setStatus,
      });
      if (run !== detectRun.current) return;
      setBoxes(found.map(withId));
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
  }, [preset, setStatus]);

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

  const updateBox = (box: CropBox) => setBoxes((bs) => bs.map((b) => (b.id === box.id ? box : b)));

  const addBox = () => {
    if (!image) return;
    const height = image.bitmap.height * 0.3;
    const box = withId({ cx: image.bitmap.width / 2, cy: image.bitmap.height / 2, height, width: height * aspect, angleDeg: 0 });
    setBoxes((bs) => [...bs, box]);
    setSelectedId(box.id);
  };

  const rotateSelected = (deg: number) =>
    setBoxes((bs) => bs.map((b) => (b.id === selectedId ? { ...b, angleDeg: wrapAngle(b.angleDeg + deg) } : b)));

  const deleteSelected = useCallback(() => {
    setBoxes((bs) => bs.filter((b) => b.id !== selectedId));
    setSelectedId(null);
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
          <svg viewBox="0 0 32 32">
            <rect x="7" y="3" width="18" height="26" rx="3" fill="#fff" opacity="0.95" />
            <circle cx="16" cy="13" r="4.2" fill="#a855f7" />
            <path d="M9.5 26.5c.9-4.4 3.5-6.8 6.5-6.8s5.6 2.4 6.5 6.8z" fill="#6366f1" />
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
          onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
          hasImage={!!image}
          hasSelection={!!selectedId}
          boxCount={boxes.length}
          busy={busy}
          onDetect={() => image && runDetect(image, settings)}
          onAddBox={addBox}
          onRotate={rotateSelected}
          onDelete={deleteSelected}
          onClear={() => { setBoxes([]); setSelectedId(null); }}
          onDownloadAll={downloadAll}
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
              <UploadDropzone onFile={onFile} compact />
            </>
          ) : (
            <UploadDropzone onFile={onFile} onTryExample={tryExample} />
          )}
        </main>
      </div>
      <HelpWizard open={helpOpen} onClose={closeHelp} onTryExample={tryExample} />
    </div>
  );
}
