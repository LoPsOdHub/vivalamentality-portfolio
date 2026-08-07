/* ==========================================================================
   works.html — two jobs:

   1. Renders all six grids (main Works split into two grids — the first
      6, then the rest joined by New Works, so together they read as one
      continuous listing — followed by the 3D, Canvas, Banned, and
      Sketches subsections, in that order) from js/works-data.js. Canvas
      cards are the odd one out: they come from js/canvas-data.js and
      link to canvas.html?piece=<id> (a turnable 3D viewer) instead of
      this page's own ?w= detail view — see renderCanvasCard.
   2. If the URL has ?w=<file>, finds that work (searching every list) and
      reveals the detail view above the grids. With no ?w=, the page is
      just the grids. With a ?w= that doesn't match anything (a typo'd or
      stale link), a small inline note explains that instead of silently
      showing nothing.
   ========================================================================== */

import {
  WORKS,
  NEW_WORKS,
  THREE_D,
  SKETCHES,
  BANNED,
  findWorkByFile,
  workUrl,
  workImageSrc,
} from "./works-data.js?v=7";
import { CANVASES, canvasUrl, canvasImageSrc } from "./canvas-data.js?v=1";

/* ---- 1. Grids ---- */

// The first 6 of the original Works, then the remaining Works continue
// joined by the New Works — split into two grids but adjacent in the page
// (see works.html), so they still read as one continuous Works listing.
// Banned and Sketches follow after, in that order.
const SPLIT_AT = 6;
const worksPrimary = WORKS.slice(0, SPLIT_AT);
const worksSecondary = [...WORKS.slice(SPLIT_AT), ...NEW_WORKS];

function renderCard(work) {
  const article = document.createElement("article");
  article.className = "card";

  const a = document.createElement("a");
  a.className = "card__frame";
  a.href = workUrl(work);

  const img = document.createElement("img");
  img.src = workImageSrc(work);
  img.alt = work.title;
  img.loading = "lazy";

  a.appendChild(img);
  article.appendChild(a);
  return article;
}

function renderGrid(containerId, works) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const fragment = document.createDocumentFragment();
  works.forEach((work) => fragment.appendChild(renderCard(work)));
  container.appendChild(fragment);
}

// Same card markup as renderCard, but linking to canvas.html's 3D viewer
// (canvasUrl) instead of this page's own ?w= detail view, and using the
// canvas's mainImage as the thumbnail — the same photo that becomes the
// 3D box's front face on its own page.
function renderCanvasCard(piece) {
  const article = document.createElement("article");
  article.className = "card";

  const a = document.createElement("a");
  a.className = "card__frame";
  a.href = canvasUrl(piece);

  const img = document.createElement("img");
  img.src = canvasImageSrc(piece.mainImage);
  img.alt = piece.title;
  img.loading = "lazy";

  a.appendChild(img);
  article.appendChild(a);
  return article;
}

function renderCanvasGrid(containerId, pieces) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const fragment = document.createDocumentFragment();
  pieces.forEach((piece) => fragment.appendChild(renderCanvasCard(piece)));
  container.appendChild(fragment);
}

renderGrid("worksGridPrimary", worksPrimary);
renderGrid("worksGridSecondary", worksSecondary);
renderGrid("threeDGrid", THREE_D);
renderCanvasGrid("canvasGrid", CANVASES);
renderGrid("bannedGrid", BANNED);
renderGrid("sketchesGrid", SKETCHES);

/* ---- 2. Detail view ---- */

// The one place on the site with a hover-zoom magnifier (see
// .work-hero__image-wrap in css/style.css) — landing on a piece's own
// page, via a click from the grid/marquee/3D hotspots, is what unlocks a
// closer look; those browsing surfaces themselves stay static. Keeps
// --zoom-x/--zoom-y matched to the cursor's position over the image so it
// magnifies from wherever you're actually pointing.
function trackZoomOrigin(frame, img) {
  frame.addEventListener("mousemove", (e) => {
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.setProperty("--zoom-x", `${x}%`);
    img.style.setProperty("--zoom-y", `${y}%`);
  });
}

const params = new URLSearchParams(location.search);
const file = params.get("w");
const work = file ? findWorkByFile(file) : null;

const detailEl = document.getElementById("workDetail");

if (work) {
  const imageEl = document.getElementById("workImage");
  const titleEl = document.getElementById("workTitle");
  const mediumEl = document.getElementById("workMedium");

  document.title = `Platon — ${work.title}`;
  imageEl.src = workImageSrc(work);
  imageEl.alt = work.title;
  titleEl.textContent = work.title;
  mediumEl.textContent = work.medium || "Fine Art";
  trackZoomOrigin(imageEl.parentElement, imageEl);
  detailEl.hidden = false;
} else if (file) {
  // A ?w= was given but didn't match anything — say so rather than
  // leaving the visitor wondering why the page looks like plain Works.
  const imageEl = document.getElementById("workImage");
  const titleEl = document.getElementById("workTitle");
  const mediumEl = document.getElementById("workMedium");
  const descEl = document.getElementById("workDesc");

  document.title = "Platon — Work not found";
  imageEl.remove();
  titleEl.textContent = "Work not found";
  mediumEl.textContent = "";
  descEl.textContent = "That link didn't match a piece here — it may be a typo or an old link. See the full list below.";
  descEl.hidden = false;
  detailEl.hidden = false;
}
