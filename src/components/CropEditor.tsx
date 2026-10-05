import Konva from 'konva';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Group, Image as KImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { headGuides, presetAspect } from '../presets';
import type { CropBox, SizePreset } from '../types';

interface Props {
  image: ImageBitmap;
  boxes: CropBox[];
  preset: SizePreset;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (box: CropBox) => void;
}

const ACCENT = '#7c3aed';
const SELECTED = '#ec4899';

/**
 * Shows the uploaded image with one rotated rectangle per crop.
 *
 * The layer is scaled so that everything inside it is in *source pixels*: box
 * coordinates go in and come out unchanged, and only stroke widths and label
 * sizes are divided by the scale to stay constant on screen.
 */
export function CropEditor({ image, boxes, preset, selectedId, onSelect, onChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [avail, setAvail] = useState({ w: 800, h: 600 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail({ w: el.clientWidth, h: Math.max(320, window.innerHeight * 0.72) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(avail.w / image.width, avail.h / image.height);
  const aspect = presetAspect(preset);
  const guides = headGuides(preset);

  // Keep the transformer attached to whichever box is selected.
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedId ? layerRef.current?.findOne(`#box-${selectedId}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, boxes]);

  const handleTransformEnd = (box: CropBox, node: Konva.Node) => {
    // Konva resizes by scaling the group; fold the scale back into width/height.
    const width = Math.max(10, box.width * Math.abs(node.scaleX()));
    node.scale({ x: 1, y: 1 });
    onChange({ ...box, cx: node.x(), cy: node.y(), width, height: width / aspect, angleDeg: node.rotation() });
  };

  const px = 1 / scale; // one screen pixel, in source pixels

  return (
    <div ref={wrapRef} className="editor">
      <Stage
        width={Math.round(image.width * scale)}
        height={Math.round(image.height * scale)}
        onMouseDown={(e) => { if (e.target.name() === 'background') onSelect(null); }}
        onTouchStart={(e) => { if (e.target.name() === 'background') onSelect(null); }}
      >
        <Layer ref={layerRef} scaleX={scale} scaleY={scale}>
          <KImage image={image} name="background" />
          {boxes.map((b, i) => {
            const selected = b.id === selectedId;
            const color = selected ? SELECTED : ACCENT;
            const hw = b.width / 2;
            const hh = b.height / 2;
            // Where the crown, eyes and chin should fall for this preset.
            const crownY = -hh + guides.crown * b.height;
            const eyeY = -hh + guides.eyes * b.height;
            const chinY = -hh + guides.chin * b.height;
            const tri = Math.min(b.width, b.height) * 0.06;
            return (
              <Group
                key={b.id}
                id={`box-${b.id}`}
                x={b.cx}
                y={b.cy}
                rotation={b.angleDeg}
                draggable
                onMouseDown={() => onSelect(b.id)}
                onTouchStart={() => onSelect(b.id)}
                onDragEnd={(e) => onChange({ ...b, cx: e.target.x(), cy: e.target.y() })}
                onTransformEnd={(e) => handleTransformEnd(b, e.target)}
              >
                <Rect x={-hw} y={-hh} width={b.width} height={b.height} stroke={color} strokeWidth={2} strokeScaleEnabled={false} fill={selected ? 'rgba(236,72,153,0.12)' : 'rgba(124,58,237,0.08)'} />
                {[crownY, eyeY, chinY].map((y, k) => (
                  <Line key={k} points={[-hw, y, hw, y]} stroke={color} strokeWidth={1} strokeScaleEnabled={false} dash={[6 * px, 4 * px]} opacity={k === 1 ? 0.9 : 0.55} listening={false} />
                ))}
                {/* Arrow marking the top edge of the finished photo. */}
                <Line points={[-tri, -hh + tri * 1.6, 0, -hh + tri * 0.4, tri, -hh + tri * 1.6]} closed fill={color} listening={false} />
                <Text x={-hw + 6 * px} y={-hh + 6 * px} text={String(i + 1)} fontSize={16 * px} fontStyle="bold" fill="#fff" stroke={color} strokeWidth={3 * px} fillAfterStrokeEnabled listening={false} />
              </Group>
            );
          })}
          <Transformer
            ref={trRef}
            keepRatio
            rotateEnabled
            flipEnabled={false}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            rotationSnaps={[0, 90, 180, 270]}
            rotationSnapTolerance={2}
            borderStroke={SELECTED}
            anchorStroke={SELECTED}
            anchorSize={12}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
          />
        </Layer>
      </Stage>
    </div>
  );
}
