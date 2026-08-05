# Platon — Fine Art & 3D Portfolio

A multi-page site: Home has a large (~90% of the viewport), centered 3D
scene you can turn by dragging it directly, with a slider, or with a small
ambient cursor wobble — plus clickable hotspots (one per object in the
scene) that highlight, preview, ease the camera in from the outside (never
from underneath), and link straight to that piece. Below that, a
continuously-scrolling marquee of the main works. Works (with Sketches and
Banned as its own subsections), Contact, and About are their own separate
pages. Plain HTML/CSS + Three.js — no build step, no framework.

## Run it locally

Three.js is loaded as an ES module and the model is fetched over HTTP, so
opening `index.html` by double-clicking it won't work (browsers block module
imports and fetches from `file://`). Serve the folder instead:

```bash
npx serve .
```

or, if you have Python:

```bash
python -m http.server 8000
```

Then open the address it prints (e.g. `http://localhost:3000`). The model
file is ~166MB, so expect a real load delay on anything slower than
localhost — there's a loading percentage shown in the stage while it fetches.

## Pages

- `index.html` — Home: the 3D hero + marquee
- `works.html` — Works: the main grid, split around a Sketches subsection
  (after the 6th piece) and closed out by a Banned subsection. Add
  `?w=<file>` (or click any piece, from any grid or the 3D hotspots) to also
  show that piece's detail view above the grids
- `contact.html` — Contact
- `about.html` — About

## What's already wired up

- `css/style.css` — all styling as CSS custom properties (palette/type/spacing at the top)
- `js/main.js` — the Three.js scene: loads `assets/models/MODEL CLAUDE 4 !!! .glb`,
  centers/fits it, handles drag + slider + cursor-wobble rotation, projects
  DOM "hotspot marker" buttons over the canvas that track each object as it
  turns, and handles hover (highlight + plaque + gentle camera zoom, clamped
  to never approach from below) and click (goes to that work's page)
- `js/works-data.js` — WORKS / NEW_WORKS / SKETCHES / BANNED and the shared
  URL/path helpers (`workUrl`, `workImageSrc`) used everywhere else
- `js/marquee.js` — renders the home page's scrolling strip from WORKS + NEW_WORKS
- `js/works-page.js` — renders all four of works.html's grids, and reveals
  its detail view when `?w=` is present

**A note on caching while you're editing:** every `<script>` tag and CSS
`<link>` on every page carries a `?v=N` version, and so does every
`import ... from "./works-data.js?v=N"` inside the JS files themselves —
bump the number after editing a file you're testing, or the browser can
silently keep running the old cached version. This bit me more than once
while building this.

## Open items / how you can help

1. **Hotspot → piece mapping isn't meaningful yet.** The scene's 9 objects
   have no natural tie to specific pieces, so each is assigned one of the
   10 main works in order (see `js/works-data.js` and the notes at the
   bottom of `js/main.js`). Tell me if you'd rather have specific objects
   tied to specific pieces on purpose.

2. **Piece descriptions.** None exist yet, so works.html shows "Description
   forthcoming." for every piece. Send real copy whenever ready.

3. **A batch of unused scans**, including `#37.jpg`'s four
   `scan_pn118623_...` siblings — see
   [assets/portfolio/README.txt](assets/portfolio/README.txt) for the full
   list. Tell me which to add, titles, and where.

4. **Fonts.** Helvetica + Akzidenz-Grotesk are commercial typefaces with no
   free CDN source, so nothing is fetched over the network for them — the
   stack falls back to system Helvetica Neue/Helvetica/Arial. If you own
   licensed Akzidenz-Grotesk webfont files, drop them in `assets/fonts/` as:
   ```
   assets/fonts/AkzidenzGrotesk-Regular.woff2
   assets/fonts/AkzidenzGrotesk-Bold.woff2
   ```
   and they load automatically, no code changes needed.

5. **A couple of placeholders to confirm:**
   - Hero footer location — currently guessed "London, UK" from your +44 number.
   - `The Sence.jpg` — kept exactly as named; say if it should read "The Sense".
   - "Man with ciggarete.jpg" displays as "Man with Cigarette" (display text only).
   - "MEMORIES 1" and "#37" are display titles guessed from their filenames.

6. **Where this deploys** (Vercel, Netlify, GitHub Pages, your own server) —
   changes the deploy instructions I'd give, not the code itself.

Nothing above blocks previewing the site now — every page is fully
browsable with the real model, textures, and artwork already in place.
