/* ==========================================================================
   works.html — two jobs:

   1. Renders all four grids (main Works split into two grids — the first
      6, then the rest joined by New Works, so together they read as one
      continuous listing — followed by the Banned subsection, then
      Sketches last) from js/works-data.js.
   2. If the URL has ?w=<file>, finds that work (searching every list) and
      reveals the detail view above the grids. With no ?w=, the page is
      just the grids. With a ?w= that doesn't match anything (a typo'd or
      stale link), a small inline note explains that instead of silently
      showing nothing.
   ========================================================================== */

import { WORKS, NEW_WORKS, SKETCHES, BANNED, findWorkByFile, workUrl, workImageSrc } from "./works-data.js?v=3";

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

renderGrid("worksGridPrimary", worksPrimary);
renderGrid("sketchesGrid", SKETCHES);
renderGrid("worksGridSecondary", worksSecondary);
renderGrid("bannedGrid", BANNED);

/* ---- 2. Detail view ---- */

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
  detailEl.hidden = false;
}
