import { useEffect, useRef, type CSSProperties } from 'react';
import { renderCrop } from '../export/renderCrop';
import type { CropBox } from '../types';
import { IconDownload } from './Icons';

interface Props {
  image: ImageBitmap;
  boxes: CropBox[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDownload: (index: number) => void;
}

const THUMB_H = 150;

/** Live thumbnails of what each crop will look like once exported. */
export function PreviewStrip({ image, boxes, selectedId, onSelect, onDownload }: Props) {
  if (!boxes.length) return null;
  return (
    <div className="previews">
      {boxes.map((b, i) => (
        <figure key={b.id} className={b.id === selectedId ? 'selected' : ''} style={{ '--i': i } as CSSProperties}>
          <Thumb image={image} box={b} onClick={() => onSelect(b.id)} />
          <figcaption>
            <span className="num">{i + 1}</span>
            <button type="button" className="link" onClick={() => onDownload(i)} aria-label={`Download photo ${i + 1}`}><IconDownload /> Save</button>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Thumb({ image, box, onClick }: { image: ImageBitmap; box: CropBox; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const w = Math.round((THUMB_H * box.width) / box.height);
    const rendered = renderCrop(image, box, w * 2, THUMB_H * 2); // 2× for sharp thumbnails on HiDPI screens
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${THUMB_H}px`;
    canvas.getContext('2d')!.drawImage(rendered, 0, 0);
  }, [image, box]);
  return <canvas ref={ref} onClick={onClick} />;
}
