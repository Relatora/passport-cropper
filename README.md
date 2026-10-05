# Passport Photo Cropper

**[Try it online →](https://relatora.github.io/passport-cropper/)** · [open it with an example scan](https://relatora.github.io/passport-cropper/#example)

A free web app that takes one picture containing several passport photos, finds each
photo, straightens it, and exports each one cropped to the chosen passport size
(35×45 mm, 2×2 in, and others) as a print-ready JPEG, either one at a time or all
together in a ZIP.

Everything runs in the browser. The photos are never uploaded anywhere.

![Six loose photos on a scanner, found at different angles (one sideways, one upside down) and exported upright](docs/screenshots/scan-loose-photos.png)

## Features

- **Scans of loose photos** at any angle, including sideways and upside-down ones, which are turned upright using face detection.
- **White-background photos on a white scanner**, where the paper edge is nearly invisible. The photo's rectangle is rebuilt from the person's silhouette.
- **Ordinary photos of one or more people**: one passport crop per face.
- **Animated step-by-step guide** that opens on the first visit (and from **How it works**), showing how to scan, what to pick and what you get.
- **Common sizes**: 35×45 mm (UK, EU, Schengen, India, Australia), 2×2 in (US), 33×48 mm (China visa), 35×35 mm, 50×70 mm (Canada), or custom.
- **Print sheets**: tile the photos onto one 4 × 6 in or 5 × 7 in photo print, or an A4 / Letter page, with cutting guides. Eight 35 × 45 mm photos fit on a 4 × 6 in print.
- **Print-ready output** at 600 dpi by default (or 300 / 1200 dpi), with the DPI written into the JPEG so it prints at the right size.
- **Private**: no server and no uploads. Images are processed on your device with OpenCV and MediaPipe compiled to WebAssembly.

![Four white-background photos whose edges are barely visible, each found and straightened](docs/screenshots/scan-white-on-white.png)

The screenshots use the synthetic test images in [`samples/`](samples/).

## Built-in guide

![The guide's first step: tilted photos on a scanner turned into straight passport photos](docs/screenshots/guide.png)

The **How it works** guide walks through the whole flow in seven animated steps: what the app
does, how to scan, which picture type to choose, the photo size and its head guide lines,
adjusting boxes, what the downloaded files look like, and printing them all on one sheet. The illustrations are inline SVG
animated with CSS (`src/components/illustrations.tsx`, `wizard.css`); with *reduce motion*
turned on, each step shows a still picture instead. The last step offers to load an example
scan, which is also reachable directly at `#example`.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + OpenCV integration tests
npm run build      # static site in dist/
```

`npm install` copies MediaPipe's WASM runtime into `public/mediapipe/`. The face-detection
model (~230 KB) is fetched from Google's MediaPipe model storage the first time faces are
used.

## Picture types

| Mode | Use it for | How it works |
| --- | --- | --- |
| **Loose photos (scan)** | Cut photos lying on a scanner or table at any angle | Builds a mask of pixels that differ from the border colour, plus Canny edges, then closes it. Each large rectangular contour becomes a photo, measured with `minAreaRect`. A white-background photo on a white scanner has no visible edge and shows up as a head-and-shoulders blob instead. Its rectangle is rebuilt from the silhouette: the side the shoulders fill end to end is the bottom edge (which also says which way is up), a line fit along it gives the tilt, the shoulders give the width, and the faint paper edge above the head gives the height (or, if it can't be seen, the size's aspect ratio). Blobs that don't fit that pattern fall back to a crop placed around the face. |
| **Photo with faces** | An ordinary photo of one or more people | MediaPipe BlazeFace runs on the whole image and on overlapping tiles, so small faces in group shots are found too. Rotation comes from the eye line, size from the eye-to-mouth distance, and position from the preset's head size and margin above the crown. |

In scan mode, an optional pass renders each crop upright and upside down
(and sideways, for square sizes) and keeps the orientation where the face detector is
most confident. This fixes photos that were placed on the scanner the wrong way round.

## Adjusting

Every detection can be corrected by hand. You can drag a box, resize it from a corner
(the aspect ratio stays locked to the chosen size), rotate it with the top handle (it
snaps at 90°), or turn it by 90° with the buttons. The ▲ marks the top of the photo.
Dashed lines show where the crown, eyes and chin should fall for the chosen size.

## Print sheets

![Eight passport photos tiled on a 4 × 6 in print, with the sheet options beside the preview](docs/screenshots/print-sheet.png)

Instead of paying for passport photos at a shop, put every copy on **one standard print**
and have it printed for cents at a photo counter, or at home. The **Print sheet** card
below the previews (also reachable from **Make a print sheet** in the Download section)
shows a live preview and offers:

| Sheet | Printed by | 35 × 45 mm | 2 × 2 in |
| --- | --- | --- | --- |
| 4 × 6 in (10 × 15 cm) | photo counter, borderless | 8 | 6 |
| 5 × 7 in (13 × 18 cm) | photo counter, borderless | 10 | 6 |
| A4 | home printer, 6 mm margin | 32 | 15 |
| US Letter | home printer, 6 mm margin | 28 | 20 |

- **Layout**: the sheet is turned portrait or landscape, whichever holds more photos, and
  the spare space is shared out evenly so the photos are easy to cut apart. Thin grey lines
  mark where to cut.
- **Contents**: fill the sheet with one photo, or alternate all of them (handy when a family
  is renewing together).
- **Exact size**: the sheet is a JPEG with its DPI stored, so printing at *Actual size / 100 %*
  gives true 35 × 45 mm photos. Browsers on phones can't create very large images, so a
  sheet uses the chosen DPI only while it stays under 16 megapixels, and otherwise steps
  down to 600 and then 300 dpi (A4 and Letter come out at 300 dpi, the usual home-print
  resolution).

The layout maths is in [`src/export/printSheet.ts`](src/export/printSheet.ts), with tests in
`printSheet.test.ts`.

## Output

Each photo is rendered at the exact pixel size for the chosen DPI: 600 dpi by default
(35×45 mm is 827×1063 px), or 300 dpi (413×531 px) and 1200 dpi (1654×2126 px). 1200 dpi
only adds real detail when the scan itself was made at 1200 dpi or more. The JPEG's JFIF
header is patched to carry that DPI, so it prints at the right physical size.

## Code map

```
src/
  App.tsx                 state, upload → detect → edit → export flow
  geometry.ts             pure helpers: angle normalisation, aspect fitting, box tests
  presets.ts              passport sizes and their head/eye proportions
  detect/
    index.ts              picks a detector, scales results, fits the preset aspect, orients
    cvDetect.ts           OpenCV scan detection (pure; also runs in Node tests)
    cv.worker.ts          runs cvDetect in a Web Worker
    faces.ts              MediaPipe face detection, face framing, auto-orientation
  components/             Toolbar, CropEditor (react-konva), PreviewStrip, UploadDropzone,
                          PrintSheetPanel, ConfirmSizeDialog,
                          HelpWizard + illustrations (animated SVG guide), Icons
  export/                 crop rendering, JFIF DPI patching, ZIP, print-sheet layout
samples/                  synthetic test images and the script that generates them
```

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). The build is served
from `/passport-cropper/`, which `vite.config.ts` sets as the base path.

Search engines get a full page even before the app loads. `index.html` contains:
- a descriptive title and meta description
- the canonical URL
- Open Graph and Twitter preview tags with [`public/og-image.png`](public/og-image.png)
- JSON-LD `WebApplication` data
- a plain-HTML introduction that the app replaces once it starts

`public/` also holds `robots.txt` and `sitemap.xml`. These follow the
[search-engine-optimization](https://github.com/marcobiedermann/search-engine-optimization)
checklist.

## Limitations

- Face framing is calibrated on real passport photos (head height ≈ 4.1 × MediaPipe's eye-to-mouth distance). Hair varies, so check the guide lines before printing.
- Faces mode does not find faces that are sideways or upside down.
- This app crops and sizes photos. It does not check background colour, lighting or
  expression against any country's rules.
