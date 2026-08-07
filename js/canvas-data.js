/* ==========================================================================
   Canvas pieces — physical stretched-canvas paintings shown as a turnable
   3D object (js/canvas-viewer.js) instead of a flat photo, since a photo
   alone loses the thing that's different about a canvas: it has an actual
   surface and edge you'd walk around in a gallery. Each entry needs:

     id            used in canvas.html?piece=<id> and nowhere else visible
     title, medium shown on the canvas's own page
     mainImage     the full, straight-on photo — becomes the 3D box's
                   front face texture (path relative to assets/portfolio/)
     detailImages  close-up photos of the same physical piece, shown as a
                   gallery below the 3D viewer (also relative to
                   assets/portfolio/)

   Deliberately its own small file rather than folded into works-data.js —
   a canvas entry's shape (multiple images, a 3D viewer) is different
   enough from a flat work's (one image, one page) that sharing the list
   would just mean every consumer has to branch on which kind it's
   looking at. Cards for these still live in the Works grid (see
   works.html's Canvas subsection + js/works-page.js), they just link to
   canvas.html instead of works.html?w=. */

export const CANVASES = [
  {
    id: "war",
    title: "War",
    medium: "Canvas",
    mainImage: "War Canvas/MAIN ARTWORK.jpg",
    detailImages: [
      "War Canvas/Scan_20260803 (46).jpg",
      "War Canvas/Scan_20260803 (47).jpg",
      "War Canvas/Scan_20260803 (48).jpg",
      "War Canvas/Scan_20260803 (49).jpg",
    ],
  },
  {
    id: "skull",
    title: "Skull",
    medium: "Canvas",
    // No separate "MAIN ARTWORK" file for this one — this scan is the
    // full straight-on view, the other four are the close-ups.
    mainImage: "Skull Canvas/Scan_20260803 (32).jpg",
    detailImages: [
      "Skull Canvas/Scan_20260803 (38).jpg",
      "Skull Canvas/Scan_20260803 (39).jpg",
      "Skull Canvas/Scan_20260803 (41).jpg",
      "Skull Canvas/Scan_20260803 (42).jpg",
      "Skull Canvas/Scan_20260803 (43).jpg",
    ],
  },
];

/** Builds the URL that opens a canvas piece's own page. */
export function canvasUrl(canvas) {
  return `canvas.html?piece=${encodeURIComponent(canvas.id)}`;
}

/** Builds an actual asset path for one of a canvas's images. Same
 *  per-segment encoding as workImageSrc in works-data.js, for the same
 *  reason: these paths include a subfolder ("War Canvas/…"), and
 *  encoding the whole string would turn that "/" into a broken "%2F". */
export function canvasImageSrc(relativePath) {
  return `assets/portfolio/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

/** Looks up a canvas by its id (as found in the ?piece= query param). */
export function findCanvasById(id) {
  return CANVASES.find((c) => c.id === id) || null;
}
