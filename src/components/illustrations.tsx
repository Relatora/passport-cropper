/**
 * Animated SVG scenes for the help wizard. Every scene is drawn on a 320 × 200
 * canvas and animated purely with CSS (see wizard.css), looping every 6 s.
 *
 * Convention: the outer <g> places an element with a `transform` *attribute*;
 * the inner <g> carries the animation class, because a CSS transform would
 * otherwise replace the positioning transform. The un-animated (base) styles
 * always show a sensible still picture, which is what users who prefer reduced
 * motion get.
 */
import type { CSSProperties } from 'react';
import { headGuides, PRESETS } from '../presets';

/** Inline style carrying CSS custom properties (delay, rotation, travel…). */
const vars = (v: Record<string, string | number>) => v as CSSProperties;

const SKIN = ['#f2c7a5', '#c98e66', '#e8b48f', '#8d5a3b'];
const HAIR = ['#3b2a20', '#1f1a17', '#7a4a26', '#2b2220'];
const SHIRT = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b'];

/** A tiny passport photo of a person, centred on (0, 0). */
export function MiniPhoto({ w = 40, h = 52, tone = 0 }: { w?: number; h?: number; tone?: number }) {
  const t = tone % SKIN.length;
  return (
    <g>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2.5} className="ill-paper" />
      <path d={`M${-w * 0.38} ${h / 2} Q${-w * 0.36} ${h * 0.14} 0 ${h * 0.13} Q${w * 0.36} ${h * 0.14} ${w * 0.38} ${h / 2}Z`} fill={SHIRT[t]} />
      <ellipse cx={0} cy={-h * 0.06} rx={w * 0.18} ry={h * 0.17} fill={SKIN[t]} />
      <ellipse cx={0} cy={-h * 0.19} rx={w * 0.2} ry={h * 0.1} fill={HAIR[t]} />
      <circle cx={-w * 0.07} cy={-h * 0.06} r={Math.max(0.8, w * 0.025)} fill="#1e1b2e" />
      <circle cx={w * 0.07} cy={-h * 0.06} r={Math.max(0.8, w * 0.025)} fill="#1e1b2e" />
      <path d={`M${-w * 0.06} ${h * 0.03} Q0 ${h * 0.07} ${w * 0.06} ${h * 0.03}`} stroke="#9a3b3b" strokeWidth={Math.max(0.6, w * 0.02)} fill="none" strokeLinecap="round" />
    </g>
  );
}

/** Upload: tilted photos on a scanner -> found -> straight passport photos. */
export function SceneOverview() {
  const loose = [
    { x: 48, y: 68, r: -12, tone: 0 },
    { x: 108, y: 74, r: 9, tone: 1 },
    { x: 58, y: 136, r: 178, tone: 2 },
    { x: 116, y: 138, r: -4, tone: 3 },
  ];
  return (
    <svg viewBox="0 0 320 200" className="ill">
      <rect x="12" y="28" width="148" height="148" rx="12" className="ill-bed" />
      {loose.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r})`}>
          <MiniPhoto tone={p.tone} />
          <rect x={-23} y={-29} width={46} height={58} rx={3} pathLength={100} className="ill-detect" style={vars({ '--d': `${0.3 + i * 0.25}s` })} />
        </g>
      ))}
      <path d="M170 102h34" pathLength={100} className="ill-flow" />
      <path d="M198 94l9 8-9 8" className="ill-arrowhead" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${232 + (i % 2) * 50} ${70 + Math.floor(i / 2) * 64})`}>
          <g className="ill-pop" style={vars({ '--d': `${1.6 + i * 0.2}s` })}>
            <MiniPhoto tone={i} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Step 1: photos drop onto the scanner glass at any angle, then the scan light sweeps. */
export function SceneScan() {
  const photos = [
    { x: 70, y: 78, r: -14, tone: 0 },
    { x: 150, y: 72, r: 7, tone: 1 },
    { x: 232, y: 80, r: 96, tone: 2 },
    { x: 104, y: 146, r: -5, tone: 3 },
    { x: 196, y: 146, r: 12, tone: 1 },
  ];
  return (
    <svg viewBox="0 0 320 200" className="ill">
      <defs>
        <linearGradient id="ill-scan-light" x1="0" x2="1">
          <stop offset="0" stopColor="#a5f3fc" stopOpacity="0" />
          <stop offset="0.5" stopColor="#a5f3fc" stopOpacity="0.9" />
          <stop offset="1" stopColor="#a5f3fc" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="22" y="30" width="276" height="158" rx="14" className="ill-bed" />
      <rect x="22" y="14" width="276" height="10" rx="5" className="ill-lid" />
      {photos.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <g className="ill-drop" style={vars({ '--r': `${p.r}deg`, '--d': `${i * 0.22}s` })}>
            <MiniPhoto tone={p.tone} w={44} h={57} />
          </g>
        </g>
      ))}
      <rect x="22" y="30" width="26" height="158" fill="url(#ill-scan-light)" className="ill-scanbar" />
    </svg>
  );
}

/** Step 2: the two picture types, highlighted in turn. */
export function SceneModes() {
  return (
    <svg viewBox="0 0 320 200" className="ill">
      {/* Loose photos */}
      <rect x="14" y="20" width="138" height="140" rx="12" className="ill-bed" />
      {[{ x: 52, y: 62, r: -10, t: 0 }, { x: 112, y: 66, r: 8, t: 1 }, { x: 82, y: 122, r: -3, t: 2 }].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r})`}><MiniPhoto tone={p.t} w={36} h={46} /></g>
      ))}
      <rect x="9" y="15" width="148" height="150" rx="15" className="ill-hl ill-hl-a" />
      <text x="83" y="186" className="ill-label" textAnchor="middle">Loose photos</text>

      {/* An ordinary photo with faces */}
      <rect x="168" y="20" width="138" height="140" rx="12" className="ill-sky" />
      {[{ x: 200, t: 0 }, { x: 237, t: 1 }, { x: 274, t: 3 }].map((p, i) => (
        <g key={i} transform={`translate(${p.x} 118)`}>
          <path d="M-20 42 Q-19 4 0 3 Q19 4 20 42Z" fill={SHIRT[p.t]} />
          <ellipse cx="0" cy="-12" rx="11" ry="14" fill={SKIN[p.t]} />
          <ellipse cx="0" cy="-23" rx="12" ry="7" fill={HAIR[p.t]} />
          <rect x="-17" y="-34" width="34" height="44" rx="2" pathLength={100} className="ill-detect ill-detect-face" style={vars({ '--d': `${3.3 + i * 0.25}s` })} />
        </g>
      ))}
      <rect x="163" y="15" width="148" height="150" rx="15" className="ill-hl ill-hl-b" />
      <text x="237" y="186" className="ill-label" textAnchor="middle">Photo with faces</text>
    </svg>
  );
}

/** One preset drawn as a photo card with crown / eye / chin guide lines. */
function SizeCard({ presetId, cx, cy, scale, className, label }: { presetId: string; cx: number; cy: number; scale: number; className: string; label: string }) {
  const p = PRESETS.find((x) => x.id === presetId)!;
  const w = p.widthMm * scale;
  const h = p.heightMm * scale;
  const g = headGuides(p);
  const top = -h / 2;
  const crown = top + g.crown * h;
  const chin = top + g.chin * h;
  const eyes = top + g.eyes * h;
  const headH = chin - crown;
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className={className}>
      <rect x={-w / 2} y={top} width={w} height={h} rx={4} className="ill-paper ill-paper-big" />
      <path d={`M${-w * 0.42} ${h / 2} Q${-w * 0.4} ${chin + headH * 0.12} 0 ${chin + headH * 0.06} Q${w * 0.4} ${chin + headH * 0.12} ${w * 0.42} ${h / 2}Z`} fill={SHIRT[0]} />
      <ellipse cx={0} cy={(eyes + chin) / 2 - headH * 0.04} rx={headH * 0.33} ry={(chin - eyes) / 2 + headH * 0.16} fill={SKIN[0]} />
      <ellipse cx={0} cy={crown + headH * 0.17} rx={headH * 0.36} ry={headH * 0.19} fill={HAIR[0]} />
      <circle cx={-headH * 0.12} cy={eyes} r={1.8} fill="#1e1b2e" />
      <circle cx={headH * 0.12} cy={eyes} r={1.8} fill="#1e1b2e" />
      {[crown, eyes, chin].map((y, i) => (
        <g key={i}>
          <line x1={-w / 2} x2={w / 2 + 14} y1={y} y2={y} className="ill-guide" />
          <text x={w / 2 + 18} y={y + 3.5} className="ill-small">{['crown', 'eyes', 'chin'][i]}</text>
        </g>
      ))}
      <text x={0} y={h / 2 + 18} textAnchor="middle" className="ill-label">{label}</text>
      </g>
    </g>
  );
}

/** Step 3: the photo size, with the head guide lines, alternating between two presets. */
export function SceneSize() {
  return (
    <svg viewBox="0 0 320 200" className="ill">
      <SizeCard presetId="35x45" cx={140} cy={92} scale={3} className="ill-fade-a" label="35 × 45 mm" />
      <SizeCard presetId="us" cx={140} cy={92} scale={2.55} className="ill-fade-b" label="2 × 2 in" />
    </svg>
  );
}

/** Step 4: a detected box is rotated into line with its photo by dragging the handle. */
export function SceneAdjust() {
  return (
    <svg viewBox="0 0 320 200" className="ill">
      <rect x="40" y="10" width="240" height="180" rx="14" className="ill-bed" />
      <g transform="translate(160 104) rotate(-10)"><MiniPhoto tone={1} w={88} h={113} /></g>
      <g transform="translate(160 104)">
        <g className="ill-adjust-box">
          <rect x="-46" y="-59" width="92" height="118" rx="2" className="ill-box" />
          <line x1="0" y1="-59" x2="0" y2="-74" className="ill-box-line" />
          <circle cx="0" cy="-78" r="5" className="ill-handle" />
          {[[-46, -59], [46, -59], [-46, 59], [46, 59]].map(([x, y], i) => (
            <rect key={i} x={x - 4} y={y - 4} width="8" height="8" rx="1.5" className="ill-handle" />
          ))}
          <path d="M-5 -50 L0 -56 L5 -50Z" className="ill-up" />
        </g>
      </g>
      <g className="ill-cursor">
        <path d="M0 0 L0 17 L4.5 12.5 L8 20 L11 18.6 L7.6 11.4 L14 11.4Z" className="ill-pointer" />
      </g>
    </svg>
  );
}

/** Step 5: the finished photos fly into a ZIP, with their print specs. */
export function SceneResult() {
  return (
    <svg viewBox="0 0 320 200" className="ill">
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${100 + i * 60} 56)`}>
          <g className="ill-fly" style={vars({ '--tx': `${60 - i * 60}px`, '--ty': '96px', '--d': `${i * 0.3}s` })}>
            <MiniPhoto tone={i} w={46} h={59} />
          </g>
        </g>
      ))}
      <g transform="translate(160 160)">
        <g className="ill-bump">
          <path d="M-34 -22 h22 l6 7 h40 a4 4 0 0 1 4 4 v35 a4 4 0 0 1 -4 4 h-68 a4 4 0 0 1 -4 -4 v-42 a4 4 0 0 1 4 -4z" className="ill-zip" />
          {[-8, -2, 4, 10].map((y) => <rect key={y} x={-3} y={y} width="6" height="3" rx="1" className="ill-zipper" />)}
          <text x="0" y="22" textAnchor="middle" className="ill-zip-text">ZIP</text>
        </g>
      </g>
      <g transform="translate(262 150)">
        <g className="ill-pop" style={vars({ '--d': '2.2s' })}>
          <rect x="-50" y="-15" width="100" height="30" rx="15" className="ill-badge" />
          <text x="0" y="-1" textAnchor="middle" className="ill-badge-text">413 × 531 px</text>
          <text x="0" y="10" textAnchor="middle" className="ill-badge-sub">300 dpi = 35 × 45 mm</text>
        </g>
      </g>
    </svg>
  );
}
