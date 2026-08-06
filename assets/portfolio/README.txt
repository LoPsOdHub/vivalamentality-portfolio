Structure (see js/works-data.js for the exact lists the site reads):

MAIN WORKS (assets/portfolio/*.jpg, in js/works-data.js as WORKS) — the
original 10, and the only list the 3D model's hotspots pull from:
  Destroy.jpg, Falling Down.jpg, Final Puff.jpg, Notes.jpg, Peace.jpg,
  Shadow.jpg, The Sence.jpg,
  This product contains meaning which is a highly addictive substance.jpg,
  Plague Doctor.jpg, Man with ciggarete.jpg

NEW WORKS (NEW_WORKS in works-data.js) — in the main Works grid and the
home page marquee, deliberately NOT on the 3D model:
  Up high.jpg, Again.png, Unfinished.jpg, MEMORIES 1.jpg, 37.jpg,
  photo_2026-08-03_19-52-10.jpg
  (display title for "Memories 1" is a guess from the filename — say
  if you want something else. 37.jpg displays as "Breathing";
  photo_2026-08-03_19-52-10.jpg displays as "War".)

3D (assets/portfolio/3D/, THREE_D in works-data.js) — its own subsection
on works.html, after the main Works grid, NOT in the marquee, NOT on the
3D hero model:
  CANVAS 3.jpg (displays as "Repair"), LIGHTHOUSE 2.jpg (as "Lighthouse"),
  LOST NFT.jpg (as "Lost"), POSTER PEACE.jpg (as "Элегия"),
  poster everlost 1.jpg (as "Lenin"), 35.jpg
  (display title for 35.jpg is "#35", a guess from the filename — say
  if you want something else)

SKETCHES (assets/portfolio/Sketches/, SKETCHES in works-data.js) — its own
subsection on works.html, NOT in the marquee, NOT on the 3D model:
  Face Drawing.jpg, Smoking man.jpg, Standing.jpg, Two Poses.jpg

BANNED (assets/portfolio/Banned/, BANNED in works-data.js) — its own
subsection at the end of works.html, titled "Banned #1"–"Banned #8", NOT
in the marquee, NOT on the 3D model:
  1.jpg through 8.jpg

NOTE ON FILENAMES: nothing under assets/portfolio/ uses a literal "#" or
"?" in its filename — both are reserved characters in URLs, and Netlify
(and most static hosts) reject deploying any file whose name contains
them. Titles can still use "#" freely (e.g. "Banned #1", "#35") since
those are just displayed text, not part of a path — only the actual file
on disk needs to stay # / ? -free.

NOT YET INCLUDED anywhere — still sitting in assets/portfolio/, tell me
which should be added, titles, and where:
  37.jpg's siblings scan_pn118623_2023-05-02-15-06-311024_1 (2).jpg,
    scan_pn118623_2023-05-02-15-07-031024_1 (2).jpg,
    scan_pn118623_2023-05-02-15-08-541024_1 (2).jpg,
    scan_pn118623_2023-10-02-15-07-54.jpg
    (raw scanner filenames, no given title — same situation as the
    Scan_20260803 files below, so left out rather than guessing one)
  Scan_20260803 (15/16/18/19/21/22/25/26/32/38/39/41/42/43/46/47/48/49).jpg
  ыфцй.jpg — unclear if this filename/title is intentional
