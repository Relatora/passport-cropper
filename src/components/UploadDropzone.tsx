import { useEffect, useRef, useState } from 'react';
import { IconSparkle, IconUpload } from './Icons';
import { MiniPhoto } from './illustrations';

interface Props {
  onFile: (file: File) => void;
  compact?: boolean;
  /** Load the bundled example scan (shown on the large dropzone only). */
  onTryExample?: () => void;
}

/** Three photos bobbing on a scanner bed: the dropzone's artwork. */
function DropArt() {
  const cards = [{ x: 58, y: 64, r: -10, t: 0 }, { x: 105, y: 58, r: 4, t: 1 }, { x: 152, y: 66, r: 12, t: 2 }];
  return (
    <svg viewBox="0 0 210 120" className="drop-art ill" aria-hidden="true">
      <rect x="8" y="10" width="194" height="104" rx="14" className="ill-bed" />
      {cards.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}>
          <g className="card"><MiniPhoto tone={c.t} w={40} h={52} /></g>
        </g>
      ))}
    </svg>
  );
}

const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Click, drag-and-drop or paste (Ctrl+V) an image. */
export function UploadDropzone({ onFile, compact, onTryExample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) onFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onFile]);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  };

  const zone = (
    <div
      className={`dropzone${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {compact ? (
        <><IconUpload /> <span>Choose another image…</span></>
      ) : (
        <>
          <DropArt />
          <strong>Drop your scan here</strong>
          <span>JPEG or PNG · click to choose a file · or paste with Ctrl+V</span>
          {/* Looks like a button, but the whole zone is the button. */}
          <span className="drop-cta" aria-hidden="true"><IconUpload /> Choose a photo</span>
        </>
      )}
    </div>
  );

  if (compact || !onTryExample) return zone;
  return (
    <div className="upload">
      {zone}
      <button type="button" className="link example-link" onClick={onTryExample}>
        <IconSparkle /> No scan handy? Try an example
      </button>
    </div>
  );
}
