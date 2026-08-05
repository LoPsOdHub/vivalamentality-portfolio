/* ==========================================================================
   Home page marquee — renders WORKS + NEW_WORKS (not Sketches, not
   Banned — those stay works.html-only subsections) into #marqueeTrack,
   twice back to back so the CSS animation's -50% loop is seamless. Add or
   remove works in js/works-data.js; this file never needs to change.
   ========================================================================== */

import { WORKS, NEW_WORKS, workUrl, workImageSrc } from "./works-data.js?v=5";

const track = document.getElementById("marqueeTrack");
const items = [...WORKS, ...NEW_WORKS];

function renderItem(work, duplicate) {
  const a = document.createElement("a");
  a.className = "marquee__item";
  a.href = workUrl(work);
  if (duplicate) {
    a.setAttribute("aria-hidden", "true");
    a.tabIndex = -1;
  }

  const img = document.createElement("img");
  img.src = workImageSrc(work);
  img.alt = duplicate ? "" : work.title;
  img.loading = "lazy";
  a.appendChild(img);

  const caption = document.createElement("span");
  caption.className = "marquee__caption";
  caption.textContent = work.title;
  a.appendChild(caption);

  return a;
}

const fragment = document.createDocumentFragment();
items.forEach((work) => fragment.appendChild(renderItem(work, false)));
items.forEach((work) => fragment.appendChild(renderItem(work, true)));
track.appendChild(fragment);
