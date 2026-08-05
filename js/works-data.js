/* ==========================================================================
   Shared work lists — used by the home page's marquee, the 3D model's
   hotspots (main.js), and works.html (grid + subsections + detail view).

   Four separate lists, on purpose:
     - WORKS      the original 10 — the only list the 3D hotspots pull
                  from (round-robin assignment, see main.js)
     - NEW_WORKS  newer additions — shown in the main grid and the
                  marquee alongside WORKS, but deliberately NOT wired into
                  the 3D model
     - SKETCHES   its own subsection on works.html only — not in the
                  marquee, not on the 3D model
     - BANNED     same as Sketches: its own subsection on works.html only

   findWorkByFile() searches all four, so a link into any of them
   (works.html?w=<file>) always resolves correctly regardless of which
   list it came from.
   ========================================================================== */

export const WORKS = [
  { file: "Destroy.jpg", title: "Destroy" },
  { file: "Falling Down.jpg", title: "Falling Down" },
  { file: "Final Puff.jpg", title: "Final Puff" },
  { file: "Notes.jpg", title: "Notes" },
  { file: "Peace.jpg", title: "Peace" },
  { file: "Shadow.jpg", title: "Shadow" },
  { file: "The Sence.jpg", title: "The Sence" },
  {
    file: "This product contains meaning which is a highly addictive substance.jpg",
    title: "This Product Contains Meaning",
  },
  // Moved off the front of the grid on request — see main.js's round-robin
  // hotspot assignment note above: order here is display order only, not
  // a curatorial choice, so moving these two doesn't affect anything else.
  { file: "Plague Doctor.jpg", title: "Plague Doctor" },
  { file: "Man with ciggarete.jpg", title: "Man with Cigarette" },
];

// EDIT ME: "#37" and "Memories 1" are display titles guessed from the
// filenames — say if you'd rather have something else.
export const NEW_WORKS = [
  { file: "Up high.jpg", title: "Up High" },
  { file: "Again.png", title: "Again" },
  { file: "Unfinished.jpg", title: "Unfinished" },
  { file: "MEMORIES 1.jpg", title: "Memories 1" },
  { file: "#37.jpg", title: "#37" },
];

const SKETCH_DIR = "Sketches/";
export const SKETCHES = [
  { file: `${SKETCH_DIR}Face Drawing.jpg`, title: "Face Drawing", medium: "Sketch" },
  { file: `${SKETCH_DIR}Smoking man.jpg`, title: "Smoking Man", medium: "Sketch" },
  { file: `${SKETCH_DIR}Standing.jpg`, title: "Standing", medium: "Sketch" },
  { file: `${SKETCH_DIR}Two Poses.jpg`, title: "Two Poses", medium: "Sketch" },
];

const BANNED_DIR = "Banned/";
export const BANNED = Array.from({ length: 8 }, (_, i) => ({
  file: `${BANNED_DIR}#${i + 1}.jpg`,
  title: `Banned #${i + 1}`,
  medium: "Banned Series",
}));

/** Builds the URL that opens a work directly on the Works page (works.html
 *  reads ?w= and shows that piece's detail view above the grid — see
 *  js/works-page.js). Encoding the whole file value (Sketches/Banned
 *  entries include a "/" for their subfolder) is fine here — it's a single
 *  opaque query value, and URLSearchParams decodes it back correctly on
 *  the other end, %2F included. */
export function workUrl(work) {
  return `works.html?w=${encodeURIComponent(work.file)}`;
}

/** Builds the actual asset path for a work's image. Unlike workUrl above,
 *  this has to encode each path segment separately — encoding the "/" in
 *  a Sketches/Banned entry's path would turn it into a literal, broken
 *  "Sketches%2FFace Drawing.jpg" instead of traversing into that folder. */
export function workImageSrc(work) {
  return `assets/portfolio/${work.file.split("/").map(encodeURIComponent).join("/")}`;
}

/** Looks up a work by its file name (as found in the ?w= query param),
 *  searching every list — main works, new works, sketches, and Banned. */
export function findWorkByFile(file) {
  return (
    WORKS.find((w) => w.file === file) ||
    NEW_WORKS.find((w) => w.file === file) ||
    SKETCHES.find((w) => w.file === file) ||
    BANNED.find((w) => w.file === file) ||
    null
  );
}
