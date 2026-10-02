import { useEffect, useRef, useState } from 'react';

interface Props {
  onFile: (file: File) => void;
  compact?: boolean;
}

const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Click, drag-and-drop or paste (Ctrl+V) an image. */
export function UploadDropzone({ onFile, compact }: Props) {
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

  return (
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
        <span>Choose another image…</span>
      ) : (
        <>
          <strong>Drop a JPEG or PNG here</strong>
          <span>or click to choose a file, or paste with Ctrl+V</span>
          <small>Everything is processed in your browser. Nothing is uploaded.</small>
        </>
      )}
    </div>
  );
}
