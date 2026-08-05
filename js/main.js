/* ==========================================================================
   PLATON — 3D HERO
   ==========================================================================

   What this file does:
     1. Renders the model into <canvas id="scene">, sized to fill its own
        .hero__stage box — a large, centered square in the middle of the
        hero (see css/style.css).
     2. Loads assets/models/MODEL CLAUDE 4 !!! .glb, centers it, and
        auto-fits the camera so it fills the stage.
     3. Turns it ONLY left/right (Y-axis) — no tilt on the other axis.
        Three things drive that rotation together: dragging directly on the
        model with the mouse (deliberate), the range slider under the stage
        (also deliberate, and stays in sync with dragging), and a small
        ambient wobble that follows the cursor without dragging (subtle,
        layered on top).
     4. Draws real DOM buttons ("hotspot markers") over the canvas, one per
        distinct object in the scene, each precisely tracking where that
        object currently sits on screen as it turns — see the notes at the
        bottom for why this is a DOM overlay instead of relying on
        hit-testing the 3D mesh directly.
     5. Hovering a marker: highlights it, shows a small plaque next to the
        cursor previewing the work behind it, and eases the camera in
        toward that object. Clicking it goes to that work's page.

   If the model hasn't loaded (or isn't there yet), a simple placeholder
   shape fills in so the page still looks alive (with no hotspots).
   ========================================================================== */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { WORKS, workUrl, workImageSrc } from "./works-data.js?v=2";

const CONFIG = {
  modelPath: "assets/models/MODEL CLAUDE 4 !!! .glb",

  // Rotation (Y-axis only). Three inputs feed the same target angle:
  // dragging (deliberate, biggest range), the slider (deliberate, mirrors
  // whatever dragging set), and a small ambient wobble from the cursor
  // when NOT dragging (subtle, layered on top of the other two).
  dragSensitivity: Math.PI * 1.1, // radians of rotation per full stage-width drag
  hoverRotationMax: 0.14,
  rotationEasing: 0.09,
  idleSpinSpeed: 0, // set >0 (radians/sec) to bring back a constant auto-spin

  cameraFov: 32,
  // Fraction of the limiting stage dimension the model's bounding box
  // should span. The stage is already a large, dedicated square (see css),
  // so this just needs a modest bleed rather than doing the "make it big"
  // work itself.
  fillFraction: 1.05,

  // Screen-space direction check used to hide a marker once its object has
  // rotated to the far side of the scene — higher = stricter (hides sooner).
  facingThreshold: 0.02,
  // Markers never render smaller than this on screen, so small objects
  // stay comfortably clickable.
  markerMinSize: 22,
  // Each marker is drawn shrunk toward its own center by this fraction, so
  // the red dashed box hugs the object instead of the full loose
  // axis-aligned projection of its bounding box (which for an irregular
  // object — a trash pile, a photoscan — can span noticeably more area
  // than what's actually visible there). Also cuts down on adjacent
  // markers overlapping, which was causing hover to flicker between two
  // objects at once ("glitching").
  markerInset: 0.22,
  // Several top-level objects can sit close enough together on screen that
  // their loose projected boxes still overlap even after the inset above —
  // e.g. the ground-clutter cluster (bins, pile, cardboard) — and an
  // overlapped marker is effectively unclickable wherever a neighbor sits
  // on top of it in the DOM. See declutterMarkerRects: each frame, any
  // still-overlapping pair is first nudged apart (up to markerDeclutterMaxDrift,
  // as a multiple of the marker's own size, so it doesn't drift far enough
  // to stop reading as "that object's" marker), then whatever's still
  // overlapping after that is shrunk (by markerDeclutterShrink per pass,
  // down to markerMinSize) until every marker has some exclusive, clickable
  // area of its own.
  markerDeclutterMaxDrift: 0.65,
  markerDeclutterIterations: 6,
  markerDeclutterShrink: 0.88,

  hotspotEmissiveIntensity: 0.5,
  // Hover zoom: reframes the camera around just the hovered object (see
  // updateCameraZoom), clamped to a gentler range than a literal best-fit
  // would give — a tight, precise fit read as too aggressive a zoom.
  zoomFillFraction: 0.4,
  zoomMargin: 1.2, // extra clearance (world units) kept between camera and surface
  // Distance is clamped to this fraction of the whole scene's diagonal,
  // regardless of how small or large the individual hovered object is.
  zoomMinDistanceRatio: 0.22,
  zoomMaxDistanceRatio: 0.62,
  zoomEasing: 0.07,
  // The approach direction's vertical component is clamped to at least
  // this (0 = never negative) — this model has no floor/underside
  // geometry, so letting the camera dip below an object's own height to
  // approach from underneath exposed the hollow interior. Clamping keeps
  // every approach level with or above the object, from the outside.
  zoomMinApproachY: 0,
};

const stageEl = document.querySelector(".hero__stage");
const canvas = document.getElementById("scene");
const loadingEl = document.querySelector(".hero__loading");
const sliderEl = document.querySelector(".hero__rotate-slider");
const markerLayer = document.querySelector(".hotspot-layer");
const plaqueEl = document.getElementById("hotspotPlaque");
const plaqueTitleEl = document.getElementById("hotspotPlaqueTitle");
const plaqueThumbEl = document.getElementById("hotspotPlaqueThumb");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------------- */
/* Renderer / scene / camera                                              */
/* ---------------------------------------------------------------------- */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, 1, 0.1, 100);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

// A second camera, kept perfectly in sync with `camera`'s framing (fov,
// aspect, near/far, base position) EXCEPT it never moves for the hover
// zoom — see updateCameraZoom. Hotspot markers are projected through this
// one instead of the live `camera`. Projecting them through the zooming
// camera was a feedback loop: hovering a marker moved the camera toward
// it, which shifted (or shrank/hid, via the facing-direction check) that
// same marker's screen rect out from under the cursor, firing
// pointerleave, snapping the zoom back out, which put the marker back
// under the cursor and fired pointerenter again — visible as rapid
// flicker/judder right as you hovered a hotspot. Keeping marker layout on
// a camera that only ever reflects the model's own rotation (never the
// hover-triggered dolly) removes the loop entirely.
const layoutCamera = new THREE.PerspectiveCamera(CONFIG.cameraFov, 1, 0.1, 100);
layoutCamera.position.copy(camera.position);
layoutCamera.lookAt(0, 0, 0);
layoutCamera.updateMatrixWorld();

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const keyLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffe3cc, 0.5);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.45));

function readCssColor(varName, fallbackHex) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  try {
    return value ? new THREE.Color(value) : new THREE.Color(fallbackHex);
  } catch {
    return new THREE.Color(fallbackHex);
  }
}

/* ---------------------------------------------------------------------- */
/* The object that gets rotated — either your model or the placeholder    */
/* ---------------------------------------------------------------------- */

const rig = new THREE.Group();
scene.add(rig);

let currentSize = new THREE.Vector3(2, 2, 2);
let baseCameraPosition = camera.position.clone();
let currentLookTarget = new THREE.Vector3(0, 0, 0);

// Populated once the real model loads.
let hotspotMeshes = []; // one representative node per clickable object (for its matrixWorld) — a Mesh for single-primitive objects, a Group for multi-primitive ones
let hotspotLocalBox = []; // that object's own bounding box, in its own local space
let hotspotMaterials = []; // every material belonging to that object (tinted together on hover)
let markerEls = []; // the invisible, click/hover-handling DOM button for each hotspot (positioned via layoutCamera — see updateHotspotMarkers)
let markerBoxEls = []; // the visible dashed/solid outline for each hotspot (positioned via the live, possibly-zooming camera, so it always lines up with what's actually on screen)
let stageWidth = 1;
let stageHeight = 1;

function buildPlaceholder() {
  const geometry = new THREE.TorusKnotGeometry(1, 0.34, 180, 24);
  const material = new THREE.MeshStandardMaterial({
    color: readCssColor("--muted", 0x7c7360),
    roughness: 0.88,
    metalness: 0.04,
  });
  return new THREE.Mesh(geometry, material);
}

function centerAndMeasure(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  object.position.sub(center);
  return size;
}

function frameCameraToSize(size) {
  const halfFovY = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);

  const distForHeight = size.y / 2 / Math.tan(halfFovY);
  const distForWidth = size.x / 2 / Math.tan(halfFovX);

  let distance = Math.max(distForHeight, distForWidth) / CONFIG.fillFraction;
  distance += size.z / 2;

  camera.position.set(0, 0, distance);
  camera.near = Math.max(0.01, distance / 100);
  camera.far = distance * 4 + size.length();
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  baseCameraPosition.copy(camera.position);
  currentLookTarget.set(0, 0, 0);

  // Keep the marker-layout camera framed identically to the base (unzoomed)
  // view — see the comment where layoutCamera is created.
  layoutCamera.fov = camera.fov;
  layoutCamera.aspect = camera.aspect;
  layoutCamera.near = camera.near;
  layoutCamera.far = camera.far;
  layoutCamera.position.copy(baseCameraPosition);
  layoutCamera.lookAt(0, 0, 0);
  layoutCamera.updateProjectionMatrix();
  layoutCamera.updateMatrixWorld();
}

function getBoxCorners(box) {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z), new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z), new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z), new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z), new THREE.Vector3(max.x, max.y, max.z),
  ];
}

// Some of this exporter's materials carry extra UV channels (up to
// TEXCOORD_4) that this version of three.js's shader chunks can't declare,
// which fails that material's shader compile outright — nothing using it
// renders. Forcing textures to channel 0 and dropping the unused UV sets
// sidesteps the bug (channel 0 / TEXCOORD_0 still has correct coordinates
// for every material seen so far).
function forceUvChannelZero(material) {
  Object.keys(material).forEach((key) => {
    const value = material[key];
    if (value && value.isTexture) value.channel = 0;
  });
}
function removeExtraUvSets(geometry) {
  ["uv1", "uv2", "uv3", "uv4"].forEach((name) => {
    if (geometry.attributes[name]) geometry.deleteAttribute(name);
  });
}

/* Every mesh in the model gets its own material (a clone of the imported
   one if it had a texture, so the real look survives; a flat fallback if
   not) plus an ink-line edge overlay. Returns the full mesh list. */
function styleAllMeshes(root) {
  const meshes = [];
  const fallbackColor = readCssColor("--muted", 0x7c7360);
  root.traverse((child) => {
    if (!child.isMesh) return;
    const hasTexture = child.material && child.material.map;
    const material = hasTexture
      ? child.material.clone()
      : new THREE.MeshStandardMaterial({ color: fallbackColor, roughness: 0.88, metalness: 0.04 });
    material.emissiveIntensity = 0;
    if (hasTexture) forceUvChannelZero(material);
    removeExtraUvSets(child.geometry);
    child.material = material;

    const edges = new THREE.EdgesGeometry(child.geometry, 25);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: readCssColor("--ink", 0x1b1712), transparent: true, opacity: 0.35 })
    );
    line.raycast = () => {};
    child.add(line);

    meshes.push(child);
  });
  return meshes;
}

/* One hotspot per top-level object in the scene (trash bins, container,
   junk piles, the text piece, etc.) — this model is a set of distinct
   objects rather than one continuous surface, so unlike a single merged
   building mesh there's no "shell" to filter out: every object here is a
   legitimate, separately clickable thing, on whichever side of the scene
   it happens to sit. */
function buildHotspots(root) {
  const hotspots = [];
  root.children.forEach((child) => {
    const meshesInChild = [];
    child.traverse((c) => {
      if (c.isMesh) meshesInChild.push(c);
    });
    if (meshesInChild.length === 0) return;

    const box = new THREE.Box3();
    meshesInChild.forEach((m) => {
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
    });
    // box is in world space at import time — convert to local space
    // relative to `child` for consistent per-frame re-projection later.
    // IMPORTANT: the reference transform used every frame (in
    // getHotspotWorldBox / updateHotspotMarkers / updateCameraZoom) has to
    // be this same `child`, not one of its descendant meshes — for a node
    // whose mesh has multiple primitives, three.js wraps them in a Group
    // and each primitive Mesh happens to sit at an identity offset from
    // it, so using the first mesh's matrixWorld instead of the group's
    // would work today, but only by coincidence of that specific case.
    // Storing `child` itself removes that fragility outright.
    const inverse = new THREE.Matrix4().copy(child.matrixWorld).invert();
    const localBox = box.clone().applyMatrix4(inverse);

    hotspots.push({ representative: child, box: localBox, materials: meshesInChild.map((m) => m.material) });
  });
  return hotspots;
}

function buildWorkAssignments(count) {
  return Array.from({ length: count }, (_, i) => WORKS[i % WORKS.length]);
}

function createMarkers(count) {
  markerLayer.innerHTML = "";
  markerBoxEls = [];
  const assignments = buildWorkAssignments(count);
  markerEls = assignments.map((work, i) => {
    // The visible outline. Purely decorative (pointer-events: none) — see
    // updateHotspotMarkers for why this is positioned separately from the
    // button below, via the live camera instead of the stable one.
    const box = document.createElement("span");
    box.className = "hotspot-marker__box";
    box.hidden = true;
    markerLayer.appendChild(box);
    markerBoxEls.push(box);

    // The actual clickable/hoverable element — invisible, positioned via
    // the stable layoutCamera so hovering it can never move it out from
    // under the cursor (see the layoutCamera comment near its declaration).
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hotspot-marker";
    btn.setAttribute("aria-label", `View ${work.title}`);
    btn.hidden = true;
    btn.addEventListener("pointerenter", () => onHotspotEnter(i, work));
    btn.addEventListener("pointermove", (e) => positionPlaque(e.clientX, e.clientY));
    btn.addEventListener("pointerleave", () => onHotspotLeave(i));
    btn.addEventListener("focus", () => onHotspotEnter(i, work, true));
    btn.addEventListener("blur", () => onHotspotLeave(i));
    btn.addEventListener("click", () => {
      window.location.href = workUrl(work);
    });
    markerLayer.appendChild(btn);
    return btn;
  });
  return assignments;
}

let hoveredHotspot = -1;

function onHotspotEnter(index, work, isKeyboard = false) {
  hoveredHotspot = index;
  (hotspotMaterials[index] || []).forEach((m) => {
    m.emissive.copy(readCssColor("--accent", 0xa23a2c));
    m.emissiveIntensity = CONFIG.hotspotEmissiveIntensity;
  });
  markerBoxEls[index]?.classList.add("is-active");
  plaqueTitleEl.textContent = work.title;
  plaqueThumbEl.src = workImageSrc(work);
  plaqueThumbEl.alt = work.title;
  plaqueEl.classList.add("is-visible");
  if (isKeyboard) {
    const r = markerEls[index].getBoundingClientRect();
    positionPlaque(r.left + r.width / 2, r.top);
  }
}

function onHotspotLeave(index) {
  if (hoveredHotspot === index) hoveredHotspot = -1;
  (hotspotMaterials[index] || []).forEach((m) => { m.emissiveIntensity = 0; });
  markerBoxEls[index]?.classList.remove("is-active");
  plaqueEl.classList.remove("is-visible");
}

function positionPlaque(x, y) {
  plaqueEl.style.left = `${x + 18}px`;
  plaqueEl.style.top = `${y + 18}px`;
}

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    encodeURI(CONFIG.modelPath),
    (gltf) => {
      const object = gltf.scene;
      currentSize = centerAndMeasure(object);
      styleAllMeshes(object); // materials/edges first, so hotspot.materials below point at the final (cloned) materials
      rig.add(object);
      // centerAndMeasure() just moved `object`, and buildHotspots() below
      // needs every descendant's matrixWorld to reflect that move — force
      // it here instead of assuming some earlier call already did.
      object.updateMatrixWorld(true);

      const hotspots = buildHotspots(object);
      hotspotMeshes = hotspots.map((h) => h.representative);
      hotspotLocalBox = hotspots.map((h) => h.box);
      hotspotMaterials = hotspots.map((h) => h.materials);

      createMarkers(hotspots.length);
      frameCameraToSize(currentSize);
      if (loadingEl) loadingEl.hidden = true;
      console.info(`[hero-3d] Loaded ${CONFIG.modelPath} — ${hotspots.length} clickable objects`);
    },
    (progress) => {
      if (loadingEl && progress.total) {
        loadingEl.textContent = `Loading scene… ${Math.round((progress.loaded / progress.total) * 100)}%`;
      }
    },
    (err) => {
      console.info(`[hero-3d] Couldn't load "${CONFIG.modelPath}" — using the placeholder shape.`, err);
      const placeholder = buildPlaceholder();
      currentSize = centerAndMeasure(placeholder);
      rig.add(placeholder);
      frameCameraToSize(currentSize);
      if (loadingEl) loadingEl.hidden = true;
    }
  );
}

loadModel();

/* ---------------------------------------------------------------------- */
/* Rotation: drag (deliberate) + slider (deliberate, synced) + cursor      */
/* (small ambient wobble, only when not dragging)                        */
/* ---------------------------------------------------------------------- */

let sliderTargetY = 0;
let sliderCurrentY = 0;
let hoverTargetY = 0;
let hoverCurrentY = 0;
let idleAngle = 0;

function setRotationTarget(radians) {
  sliderTargetY = radians;
  if (sliderEl) sliderEl.value = String(Math.round(THREE.MathUtils.radToDeg(radians)));
}

if (sliderEl) {
  sliderEl.addEventListener("input", () => {
    sliderTargetY = THREE.MathUtils.degToRad(Number(sliderEl.value));
  });
}

// Click-and-drag directly on the model to spin it.
let isDragging = false;
let dragStartX = 0;
let dragStartRotation = 0;

canvas.addEventListener("pointerdown", (event) => {
  isDragging = true;
  dragStartX = event.clientX;
  dragStartRotation = sliderTargetY;
  canvas.classList.add("is-dragging");
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!isDragging) return;
  const deltaX = (event.clientX - dragStartX) / stageWidth;
  setRotationTarget(dragStartRotation + deltaX * CONFIG.dragSensitivity);
});
function endDrag() {
  isDragging = false;
  canvas.classList.remove("is-dragging");
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

function onPointerMove(event) {
  if (isDragging) return; // dragging already drives rotation directly
  const rect = stageEl.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  hoverTargetY = THREE.MathUtils.clamp(nx, -1, 1) * CONFIG.hoverRotationMax;
}
window.addEventListener("pointermove", onPointerMove, { passive: true });
window.addEventListener("pointerleave", () => {
  hoverTargetY = 0;
});

/* ---------------------------------------------------------------------- */
/* Resize                                                                  */
/* ---------------------------------------------------------------------- */

function resize() {
  stageWidth = stageEl.clientWidth;
  stageHeight = stageEl.clientHeight;
  renderer.setSize(stageWidth, stageHeight, false);
  camera.aspect = stageWidth / stageHeight;
  frameCameraToSize(currentSize);
}
window.addEventListener("resize", resize);
resize();

/* ---------------------------------------------------------------------- */
/* Per-frame: marker projection + hover zoom                              */
/* ---------------------------------------------------------------------- */

// Projects one hotspot's box corners through `cam`, returning its 2D
// screen-space AABB (in px) plus whether any corner landed in front of the
// camera. Shared by the stable hit-area projection and the live visual one
// below — same math, different camera.
function projectBoxToScreen(mesh, box, cam) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let anyInFront = false;
  for (const corner of getBoxCorners(box)) {
    const world = corner.applyMatrix4(mesh.matrixWorld);
    const ndc = world.project(cam);
    if (ndc.z > 1 || ndc.z < -1) continue;
    anyInFront = true;
    const sx = (ndc.x * 0.5 + 0.5) * stageWidth;
    const sy = (1 - (ndc.y * 0.5 + 0.5)) * stageHeight;
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
  }
  return { minX, minY, maxX, maxY, anyInFront };
}

// Shrinks a projected AABB toward its own center (hug the object rather
// than its loose projected bounding box — see CONFIG.markerInset), then
// enforces the minimum clickable/visible size.
function shapeMarkerRect(rect) {
  const cx0 = (rect.minX + rect.maxX) / 2;
  const cy0 = (rect.minY + rect.maxY) / 2;
  let w = (rect.maxX - rect.minX) * (1 - CONFIG.markerInset);
  let h = (rect.maxY - rect.minY) * (1 - CONFIG.markerInset);
  let minX = cx0 - w / 2;
  let minY = cy0 - h / 2;
  if (w < CONFIG.markerMinSize) {
    minX = cx0 - CONFIG.markerMinSize / 2;
    w = CONFIG.markerMinSize;
  }
  if (h < CONFIG.markerMinSize) {
    minY = cy0 - CONFIG.markerMinSize / 2;
    h = CONFIG.markerMinSize;
  }
  return { minX, minY, w, h };
}

// Given the current frame's shaped marker rects (see shapeMarkerRect),
// nudges/shrinks any that still overlap so every hotspot keeps some
// exclusive, clickable area — without this, several close-together
// objects (e.g. the ground-clutter cluster: bins, pile, cardboard) project
// to boxes that stack on top of each other, and only the topmost in DOM
// order can ever be clicked.
//
// Two passes, each bounded so a marker never drifts or shrinks far enough
// to stop reading as "that object's" marker:
//   1. Push overlapping pairs apart along whichever axis needs the least
//      movement to separate them (standard AABB separation), clamped to
//      CONFIG.markerDeclutterMaxDrift × the marker's own size, measured
//      from where it actually projects (its "anchor").
//   2. Whatever's still overlapping once every marker has used up its
//      drift budget gets shrunk instead, by CONFIG.markerDeclutterShrink
//      per pass, down to CONFIG.markerMinSize.
//
// `items` is mutated in place: each gets `cx`/`cy` (final center) and
// `w`/`h` (final size, ≤ its original rawW/rawH) written onto it.
function declutterMarkerRects(items) {
  if (items.length < 2) return;

  const maxDrift = (item) => Math.max(item.rawW, item.rawH) * CONFIG.markerDeclutterMaxDrift;

  const clampToAnchor = (item) => {
    const dx = item.cx - item.anchorX;
    const dy = item.cy - item.anchorY;
    const drift = Math.hypot(dx, dy);
    const max = maxDrift(item);
    if (drift > max && drift > 0) {
      const k = max / drift;
      item.cx = item.anchorX + dx * k;
      item.cy = item.anchorY + dy * k;
    }
  };

  for (let iter = 0; iter < CONFIG.markerDeclutterIterations; iter++) {
    let anyOverlap = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const overlapX = (a.w + b.w) / 2 - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        anyOverlap = true;
        if (overlapX < overlapY) {
          const push = overlapX / 2 + 0.5;
          const dir = dx >= 0 ? 1 : -1;
          a.cx -= push * dir;
          b.cx += push * dir;
        } else {
          const push = overlapY / 2 + 0.5;
          const dir = dy >= 0 ? 1 : -1;
          a.cy -= push * dir;
          b.cy += push * dir;
        }
        clampToAnchor(a);
        clampToAnchor(b);
      }
    }
    if (!anyOverlap) return;
  }

  for (let iter = 0; iter < CONFIG.markerDeclutterIterations; iter++) {
    let anyOverlap = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const overlapX = (a.w + b.w) / 2 - Math.abs(b.cx - a.cx);
        const overlapY = (a.h + b.h) / 2 - Math.abs(b.cy - a.cy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        anyOverlap = true;
        a.w = Math.max(CONFIG.markerMinSize, a.w * CONFIG.markerDeclutterShrink);
        a.h = Math.max(CONFIG.markerMinSize, a.h * CONFIG.markerDeclutterShrink);
        b.w = Math.max(CONFIG.markerMinSize, b.w * CONFIG.markerDeclutterShrink);
        b.h = Math.max(CONFIG.markerMinSize, b.h * CONFIG.markerDeclutterShrink);
      }
    }
    if (!anyOverlap) return;
  }
}

function updateHotspotMarkers() {
  // Pass 1: figure out each hotspot's visibility and, for the visible
  // ones, its raw (pre-declutter) stable hit rect — gathered up front
  // because decluttering needs every marker's rect at once, not one at a
  // time. `frame[i]` stays null for hidden hotspots.
  const frame = [];
  const declutterItems = [];

  for (let i = 0; i < hotspotMeshes.length; i++) {
    const mesh = hotspotMeshes[i];
    const box = hotspotLocalBox[i];
    const btn = markerEls[i];
    if (!btn) { frame.push(null); continue; }

    // The clickable area's position AND its show/hide decision both come
    // from the stable layoutCamera — never the live, possibly-zooming
    // `camera` — so hovering a marker can't move or hide the very
    // element that's being hovered. See the layoutCamera comment above.
    const stableRect = projectBoxToScreen(mesh, box, layoutCamera);

    const centroidWorld = box.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
    // If an object's centroid lands too close to the scene origin,
    // normalizing it is numerically unstable (a near-zero-length vector's
    // direction is mostly noise), which would make `facing` flicker at
    // random — treat that case as "always facing" instead of guessing.
    const centroidLenSq = centroidWorld.lengthSq();
    let facing = 1;
    if (centroidLenSq > 1e-6) {
      const outward = centroidWorld.clone().normalize();
      const viewDir = layoutCamera.position.clone().sub(centroidWorld).normalize();
      facing = outward.dot(viewDir);
    }

    const onScreen =
      stableRect.maxX > 0 && stableRect.minX < stageWidth && stableRect.maxY > 0 && stableRect.minY < stageHeight;
    const visible = stableRect.anyInFront && facing > CONFIG.facingThreshold && onScreen;

    if (!visible) {
      btn.hidden = true;
      if (markerBoxEls[i]) markerBoxEls[i].hidden = true;
      frame.push(null);
      continue;
    }

    const hitShape = shapeMarkerRect(stableRect);
    const item = {
      cx: hitShape.minX + hitShape.w / 2,
      cy: hitShape.minY + hitShape.h / 2,
      w: hitShape.w,
      h: hitShape.h,
      rawW: hitShape.w,
      rawH: hitShape.h,
    };
    item.anchorX = item.cx;
    item.anchorY = item.cy;
    declutterItems.push(item);
    frame.push({ mesh, box, item });
  }

  // Pass 2: resolve overlaps across every visible marker at once.
  declutterMarkerRects(declutterItems);

  // Pass 3: apply the (now decluttered) hit rect to each button, and the
  // same positional/size correction carried over to the live-camera
  // projection for its visible outline — so the outline still matches
  // where the clickable area actually ended up instead of drifting back
  // on top of a neighbor.
  for (let i = 0; i < hotspotMeshes.length; i++) {
    const meta = frame[i];
    const btn = markerEls[i];
    const boxEl = markerBoxEls[i];
    if (!meta || !btn) continue;

    const { mesh, box, item } = meta;
    btn.hidden = false;
    btn.style.left = `${item.cx - item.w / 2}px`;
    btn.style.top = `${item.cy - item.h / 2}px`;
    btn.style.width = `${item.w}px`;
    btn.style.height = `${item.h}px`;

    if (!boxEl) continue;

    // The visible outline tracks the LIVE camera instead, so it always
    // lines up with the object as actually rendered (including while the
    // hover zoom is dollying in on it). It's pointer-events: none, so
    // letting it move freely here can't reintroduce the feedback loop
    // that keeping the hit area on the live camera caused.
    const liveRect = projectBoxToScreen(mesh, box, camera);
    if (!liveRect.anyInFront) {
      boxEl.hidden = true;
      continue;
    }
    const liveShapeRaw = shapeMarkerRect(liveRect);
    const dx = item.cx - item.anchorX;
    const dy = item.cy - item.anchorY;
    const scaleW = item.rawW > 0 ? item.w / item.rawW : 1;
    const scaleH = item.rawH > 0 ? item.h / item.rawH : 1;
    const liveW = liveShapeRaw.w * scaleW;
    const liveH = liveShapeRaw.h * scaleH;
    const liveCx = liveShapeRaw.minX + liveShapeRaw.w / 2 + dx;
    const liveCy = liveShapeRaw.minY + liveShapeRaw.h / 2 + dy;
    boxEl.hidden = false;
    boxEl.style.left = `${liveCx - liveW / 2}px`;
    boxEl.style.top = `${liveCy - liveH / 2}px`;
    boxEl.style.width = `${liveW}px`;
    boxEl.style.height = `${liveH}px`;
  }
}

function isFiniteVector3(v) {
  return Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

// World-space AABB of one hotspot, recomputed every call since the model
// (and therefore the mesh's matrixWorld) keeps turning.
function getHotspotWorldBox(index) {
  const mesh = hotspotMeshes[index];
  const corners = getBoxCorners(hotspotLocalBox[index]).map((c) => c.applyMatrix4(mesh.matrixWorld));
  return new THREE.Box3().setFromPoints(corners);
}

// Reframes the camera around just the hovered object — fit-to-frame math
// like frameCameraToSize, aimed at a small world-space box instead of the
// whole scene, with the result clamped to a proportion of the whole
// scene's scale (see CONFIG.zoomMinDistanceRatio/zoomMaxDistanceRatio).
// That clamp is deliberately generous now (a gentler zoom reads better
// than a tight best-fit), and it's also what stops a small or oddly-shaped
// object from pulling the camera in dangerously close, which previously
// read as a sudden extreme zoom and caused lag. The approach direction is
// also clamped to never dip below horizontal (CONFIG.zoomMinApproachY),
// since this model has no underside geometry — without that, hovering an
// object low in the scene could pull the camera under it and look up into
// the hollow interior. Every step is guarded against non-finite results,
// with a final self-heal back to the base view if anything still slips
// through — a `lerp` toward a NaN target corrupts the camera permanently
// otherwise, since any math with NaN afterward stays NaN.
function updateCameraZoom() {
  let targetPos = baseCameraPosition;
  let targetLook = new THREE.Vector3(0, 0, 0);

  if (hoveredHotspot !== -1 && hotspotMeshes[hoveredHotspot]) {
    const worldBox = getHotspotWorldBox(hoveredHotspot);
    const size = worldBox.getSize(new THREE.Vector3());
    const center = worldBox.getCenter(new THREE.Vector3());

    const overallDiagonal = currentSize.length() || 1;
    const minDistance = Math.max(overallDiagonal * CONFIG.zoomMinDistanceRatio, camera.near * 20);
    const maxDistance = overallDiagonal * CONFIG.zoomMaxDistanceRatio;

    const halfFovY = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
    const distForHeight = size.y / 2 / Math.tan(halfFovY);
    const distForWidth = size.x / 2 / Math.tan(halfFovX);

    let distance = Math.max(distForHeight, distForWidth) / CONFIG.zoomFillFraction + size.z / 2 + CONFIG.zoomMargin;
    if (!Number.isFinite(distance)) distance = minDistance;
    distance = THREE.MathUtils.clamp(distance, minDistance, maxDistance);

    const outward = center.lengthSq() > 1e-6 ? center.clone().normalize() : baseCameraPosition.clone().normalize();
    // Never approach from below — this model isn't capped underneath, so a
    // camera position lower than the object looks up into open geometry.
    // Clamping the vertical component (then renormalizing, since clamping
    // a component of a unit vector leaves it no longer unit length) keeps
    // every approach angle level with or above the object instead.
    if (outward.y < CONFIG.zoomMinApproachY) {
      outward.y = CONFIG.zoomMinApproachY;
      if (outward.lengthSq() > 1e-6) outward.normalize();
    }

    const candidatePos = center.clone().addScaledVector(outward, distance);
    if (isFiniteVector3(candidatePos) && isFiniteVector3(center)) {
      targetPos = candidatePos;
      targetLook = center;
    }
  }

  camera.position.lerp(targetPos, CONFIG.zoomEasing);
  currentLookTarget.lerp(targetLook, CONFIG.zoomEasing);

  if (!isFiniteVector3(camera.position)) {
    camera.position.copy(baseCameraPosition);
    currentLookTarget.set(0, 0, 0);
  }

  camera.lookAt(currentLookTarget);
  camera.updateMatrixWorld();
}

/* ---------------------------------------------------------------------- */
/* Render loop                                                             */
/* ---------------------------------------------------------------------- */

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (prefersReducedMotion) {
    rig.rotation.set(0, sliderTargetY, 0);
  } else {
    sliderCurrentY += (sliderTargetY - sliderCurrentY) * CONFIG.rotationEasing;
    hoverCurrentY += (hoverTargetY - hoverCurrentY) * CONFIG.rotationEasing;
    idleAngle += CONFIG.idleSpinSpeed * dt;
    rig.rotation.y = sliderCurrentY + hoverCurrentY + idleAngle;
    rig.rotation.x = 0;
  }
  rig.updateMatrixWorld(true);

  updateCameraZoom();
  if (hotspotMeshes.length > 0) updateHotspotMarkers();

  renderer.render(scene, camera);
}
animate();

/* ==========================================================================
   NOTES

   - This model is a set of distinct objects (trash bins, a container, junk
     piles, a large text piece, plus the earlier building tucked in as a
     minor element) rather than one continuous building facade, so
     hotspots are one per top-level object — see buildHotspots(). Which
     work shows behind which object is still just assignment order (see
     js/works-data.js), not a deliberate curatorial choice.

   - Hotspot markers are plain DOM <button> elements repositioned every
     frame from a 3D→2D projection of each object's bounding box, rather
     than raycasting into the 3D scene on click/hover — that gives crisp,
     always-visible-if-faint rectangular click zones instead of fuzzy
     per-triangle hit-testing, and keeps them fully keyboard-accessible
     since they're real buttons, not canvas pixels.

   - This page uses ES module imports and fetches the .glb over HTTP, which
     browsers block from a bare file:// path (CORS). Serve the folder with
     any static server, e.g. `npx serve .` or `python -m http.server 8000`,
     then open the printed http://localhost:... address. The file is
     ~166MB, so expect a real loading delay on anything other than
     localhost — the stage shows a loading percentage while it fetches.
   ========================================================================== */
