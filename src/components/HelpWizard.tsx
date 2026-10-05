import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconArrowLeft, IconArrowRight, IconClose, IconSparkle, IconUpload } from './Icons';
import { SceneAdjust, SceneModes, SceneOverview, SceneResult, SceneScan, SceneSheet, SceneSize } from './illustrations';
import './wizard.css';

interface Step {
  kicker: string;
  title: string;
  scene: ReactNode;
  body: ReactNode;
  points: ReactNode[];
}

const STEPS: Step[] = [
  {
    kicker: 'Welcome',
    title: 'Passport photos, sorted in seconds',
    scene: <SceneOverview />,
    body: 'Scan several passport photos at once. Each one is found, straightened and cropped to the official size, ready to print.',
    points: [
      'Photos can lie at any angle, even upside down.',
      'Free, and private: your photos never leave this device.',
      'Takes about a minute from scan to ZIP.',
    ],
  },
  {
    kicker: 'Step 1 · Scan',
    title: 'Scan or photograph your photos',
    scene: <SceneScan />,
    body: 'Lay the printed photos on the scanner glass with a small gap between them and scan the whole bed.',
    points: [
      'Any angle is fine. Crooked or sideways photos are straightened for you.',
      'Scan at 600 dpi (or more) and save as JPEG or PNG.',
      'A phone photo works too: use a plain surface, darker is better for white-background photos.',
    ],
  },
  {
    kicker: 'Step 2 · Picture type',
    title: 'Tell it what you uploaded',
    scene: <SceneModes />,
    body: 'Pick the type that matches your picture, so the right detector runs.',
    points: [
      <><strong>Loose photos (scan):</strong> each photo is found by its outline, even white photos on a white scanner.</>,
      <><strong>Photo with faces:</strong> an ordinary photo. A passport crop is framed around every face.</>,
    ],
  },
  {
    kicker: 'Step 3 · Size',
    title: 'Choose the photo size',
    scene: <SceneSize />,
    body: 'Pick your country’s size: 35 × 45 mm, 2 × 2 in, 33 × 48 mm, 35 × 35 mm, 50 × 70 mm, or a custom size.',
    points: [
      'Every crop keeps exactly that shape.',
      'Dashed guide lines show where the crown, eyes and chin should fall.',
      '600 dpi suits almost any printer; 300 dpi makes smaller files, and 1200 dpi suits very high-resolution scans.',
    ],
  },
  {
    kicker: 'Step 4 · Check',
    title: 'Check the boxes and adjust',
    scene: <SceneAdjust />,
    body: 'A numbered box appears on every photo found. Usually there is nothing to fix, but you can:',
    points: [
      'Drag a box to move it, or pull a corner to resize it.',
      'Use the round handle to rotate it, or the ⟲ ⟳ buttons to turn it 90°.',
      'The ▲ marks the top of the photo. Press Delete to remove a box, or add one by hand.',
    ],
  },
  {
    kicker: 'Step 5 · Download',
    title: 'What you get',
    scene: <SceneResult />,
    body: 'One JPEG per photo, straight and upright, at the exact print size, all bundled in a ZIP.',
    points: [
      'For example 827 × 1063 px at 600 dpi, which prints at exactly 35 × 45 mm.',
      'The DPI is stored in the file, so print shops get the size right.',
      'Save photos one by one, or all of them at once as a ZIP.',
    ],
  },
  {
    kicker: 'Step 6 · Print',
    title: 'Print them all on one sheet',
    scene: <SceneSheet />,
    body: 'Skip the photo booth: the print sheet tiles every copy onto a single print, with grey lines to cut along.',
    points: [
      <>One <strong>4 × 6 in photo print</strong> holds eight 35 × 45 mm photos (or six 2 × 2 in) and costs cents at a photo counter.</>,
      'Choose 5 × 7 in, or A4 / Letter paper for a home printer.',
      'Fill the sheet with one photo, or alternate all of them.',
      'Print at “Actual size” (100 %), not “Fit to page”, then cut along the lines.',
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Close the wizard and load the bundled example scan. */
  onTryExample: () => void;
}

/**
 * Step-by-step, animated introduction to the app. Opens automatically on the
 * first visit and from the "How it works" button. Keyboard: ← → to move,
 * Esc to close; focus moves into the dialog and back to the opener afterwards.
 */
export function HelpWizard({ open, onClose, onTryExample }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const last = STEPS.length - 1;

  const go = (to: number) => {
    if (to < 0 || to > last || to === step) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDir(1);
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(step + 1);
      if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  const s = STEPS[step];

  return (
    <div className="wizard-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabIndex={-1}>
        <div className="wizard-progress" aria-hidden="true">
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <button type="button" className="icon-btn wizard-close" onClick={onClose} aria-label="Close help">
          <IconClose />
        </button>

        <div className="wizard-body">
          <div className="wizard-stage" key={`stage-${step}`} data-dir={dir} aria-hidden="true">
            {s.scene}
          </div>
          <div className="wizard-text" key={`text-${step}`} data-dir={dir}>
            <p className="wizard-kicker">{s.kicker}</p>
            <h2 id="wizard-title">{s.title}</h2>
            <p>{s.body}</p>
            <ul>
              {s.points.map((pt, i) => (
                <li key={i} style={{ animationDelay: `${0.15 + i * 0.09}s` }}>{pt}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="wizard-footer">
          <div className="wizard-dots" role="tablist" aria-label="Help steps">
            {STEPS.map((st, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`${i + 1}. ${st.title}`}
                className={i === step ? 'active' : i < step ? 'done' : ''}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <div className="wizard-nav">
            {step > 0 && (
              <button type="button" className="ghost" onClick={() => go(step - 1)}>
                <IconArrowLeft /> Back
              </button>
            )}
            {step < last ? (
              <button type="button" className="primary" onClick={() => go(step + 1)}>
                Next <IconArrowRight />
              </button>
            ) : (
              <>
                <button type="button" className="ghost" onClick={onTryExample}>
                  <IconSparkle /> Try an example
                </button>
                <button type="button" className="primary" onClick={onClose}>
                  <IconUpload /> Use my photos
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
