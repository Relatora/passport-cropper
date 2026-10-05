/**
 * Small stroke icons drawn inline (24 × 24 grid, currentColor), so the app needs
 * no icon font or extra dependency. Purely decorative: always aria-hidden.
 */
import type { ReactNode, SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

export const IconScan = (p: P) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><rect x="6.5" y="7.5" width="5" height="6.5" rx="0.5" transform="rotate(-8 9 10.75)" /><rect x="13" y="8" width="5" height="6.5" rx="0.5" transform="rotate(6 15.5 11.25)" /></Icon>
);
export const IconFaces = (p: P) => (
  <Icon {...p}><circle cx="8" cy="9" r="2.5" /><circle cx="16" cy="9" r="2.5" /><path d="M3.5 18c.8-2.6 2.5-4 4.5-4s3.7 1.4 4.5 4M11.5 18c.8-2.6 2.5-4 4.5-4s3.7 1.4 4.5 4" /></Icon>
);
export const IconHelp = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6v.4" /><path d="M12 17h.01" /></Icon>
);
export const IconLock = (p: P) => (
  <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></Icon>
);
export const IconDownload = (p: P) => (
  <Icon {...p}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></Icon>
);
export const IconUpload = (p: P) => (
  <Icon {...p}><path d="M12 16V5M7 10l5-5 5 5M5 20h14" /></Icon>
);
export const IconPlus = (p: P) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const IconRotateLeft = (p: P) => (
  <Icon {...p}><path d="M4 4v5h5" /><path d="M4.6 13.5A8 8 0 1 0 6.3 6.3L4 9" /></Icon>
);
export const IconRotateRight = (p: P) => (
  <Icon {...p}><path d="M20 4v5h-5" /><path d="M19.4 13.5A8 8 0 1 1 17.7 6.3L20 9" /></Icon>
);
export const IconTrash = (p: P) => (
  <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Icon>
);
export const IconSparkle = (p: P) => (
  <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></Icon>
);
export const IconCheck = (p: P) => (
  <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>
);
export const IconClose = (p: P) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
);
export const IconArrowLeft = (p: P) => (
  <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>
);
export const IconArrowRight = (p: P) => (
  <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
);
export const IconSheet = (p: P) => (
  <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="1.5" /><rect x="6" y="8" width="3.5" height="4.5" rx="0.4" /><rect x="10.25" y="8" width="3.5" height="4.5" rx="0.4" /><rect x="14.5" y="8" width="3.5" height="4.5" rx="0.4" /></Icon>
);
export const IconAlert = (p: P) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></Icon>
);
