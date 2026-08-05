/* ==========================================================================
   Home page marquee — renders WORKS + NEW_WORKS (not Sketches, not
   Banned — those stay works.html-only subsections) into #marqueeTrack,
   twice back to back so the CSS animation's -50% loop is seamless. Add or
   remove works in js/works-data.js; this file never needs to change.
   ========================================================================== */

import { WORKS, NEW_WORKS, workUrl, workImageSrc } from "./works-data.js?v=5";

const track = document.getElementById("marqueeTrack");
const items = [...WORKS, ...NEW_WORKS];

// Keeps --zoom-x/--zoom-y (read by .marquee__item img's transform-origin
// in css/style.css) matched to the cursor's position over the item, so
// the hover-zoom magnifies from wherever you're actually pointing rather
// than always from the center.
function trackZoomOrigin(item, img) {
  item.addEventListener("mousemove", (e) => {
    const rect = item.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.setProperty("--zoom-x", `${x}%`);
    img.style.setProperty("--zoom-y", `${y}%`);
  });
}

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
  trackZoomOrigin(a, img);

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
