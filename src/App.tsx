import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CropEditor } from './components/CropEditor';
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

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [boxes, setBoxes] = useState<CropBox[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    mode: 'scan', presetId: PRESETS[0].id, customW: 35, customH: 45, dpi: 300, rows: 0, cols: 0, orient: true,
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
        mode: s.mode, preset, rows: s.rows, cols: s.cols, orient: s.orient, onStatus: setStatus,
      });
      if (run !== detectRun.current) return;
      setBoxes(found.map(withId));
      setSelectedId(null);
      const gridHint = s.mode === 'grid' && !(s.rows && s.cols) ? ' If the grid split is wrong, enter the rows and columns and detect again.' : '';
      setStatus(found.length
        ? `Found ${found.length} photo${found.length === 1 ? '' : 's'}. Adjust the boxes if needed, then download.${gridHint}`
        : 'Nothing found. Try another picture type, or add boxes by hand.');
    } catch (err) {
      if (run !== detectRun.current) return;
      console.error(err);
      setError(`Detection failed: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('');
    } finally {
      if (run === detectRun.current) setBusy(false);
    }
  }, [preset]);

  const onFile = useCallback(async (file: File) => {
    try {
      // The previous bitmap is left to the garbage collector rather than close()d:
      // Konva or an in-flight detection may still be drawing from it.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const loaded = { bitmap, baseName: file.name.replace(/\.[^.]+$/, '') || 'photo' };
      setImage(loaded);
      setBoxes([]);
      void runDetect(loaded, settings);
    } catch {
      setError('Could not read that file. Please use a JPEG or PNG image.');
    }
  }, [runDetect, settings]);

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
    setStatus('Preparing ZIP…');
    try {
      downloadBlob(await exportZip(image.bitmap, boxes, preset, settings.dpi, image.baseName), `${image.baseName}-passport-photos.zip`);
      setStatus(`Downloaded ${boxes.length} photo${boxes.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Passport Photo Cropper</h1>
        <p>Upload a picture with several passport photos. They are found, straightened and cropped to the size you choose.</p>
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
          {(status || error) && <div className={`status${error ? ' error' : ''}`} role="status">{error || status}</div>}
          {image ? (
            <>
              <CropEditor image={image.bitmap} boxes={boxes} preset={preset} selectedId={selectedId} onSelect={setSelectedId} onChange={updateBox} />
              <PreviewStrip image={image.bitmap} boxes={boxes} selectedId={selectedId} onSelect={setSelectedId} onDownload={downloadOne} />
              <UploadDropzone onFile={onFile} compact />
            </>
          ) : (
            <UploadDropzone onFile={onFile} />
          )}
        </main>
      </div>
    </div>
  );
}
