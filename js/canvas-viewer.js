/* ==========================================================================
   CANVAS VIEWER — canvas.html?piece=<id>
   ==========================================================================

   What this file does:
     1. Looks up ?piece=<id> in js/canvas-data.js. No match (or no id at
        all) shows #canvasNotFound and stops there — everything below
        only runs once a real piece is found.
     2. Loads that piece's mainImage as a texture and maps it onto the
        front face of a thin box — a stretched canvas rather than a flat
        plane, so turning it past ~80° shows a believable edge instead of
        a vanishing sliver. The box's proportions match the photo's own
        aspect ratio once it's loaded. Every other face (sides and back)
        is a flat color — a real canvas-back photo was tried here and
        read as visual noise against the rest of the site's design, so
        it's back to a plain block on purpose. Deliberately unlit
        (MeshBasicMaterial, no scene lights) — mainImage is a photo that
        already has its own real-world lighting baked in; adding
        synthetic studio lights on top just re-lights an already-lit
        photo and washes it out into glare.
     3. Wires up OrbitControls so dragging turns the piece freely in any
        direction (not just left/right, unlike the home hero's model) and
        scroll/pinch zooms in on it — this page's whole point is letting
        you get close to one piece, so there's no reason to hold back the
        vertical axis the way the hero does. The camera frames around the
        box's full diagonal rather than its resting width/height, so
        corners never clip regardless of which way it's been turned.
     4. A slow constant idle rotation, same idea and speed as the home
        hero's (js/main.js CONFIG.idleSpinSpeed) — off entirely under
        prefers-reduced-motion.
     5. Renders the piece's detailImages as a plain grid below the
        viewer, each linking to the full photo in a new tab.
     6. If the piece has a stencilFont (see js/canvas-data.js — currently
        just War), shows the "Stencil It" tool below the gallery: type
        anything, press the plaque, and it re-renders in that font with a
        fresh small random tilt each press.

   No lights, no environment map, and the renderer clears to fully
   transparent (see CONFIG below) — the piece floats directly on the
   page's own background instead of sitting in its own separate box.
   ========================================================================== */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CANVASES, canvasImageSrc } from "./canvas-data.js?v=2";

const CONFIG = {
  cameraFov: 32,
  // How far out the camera sits, as a multiple of the box's own radius
  // (half its diagonal) — deliberately generous, and applied to the
  // diagonal rather than the resting width/height, so turning the piece
  // to any angle never pushes a corner past the edge of the frame.
  viewMargin: 1.6,
  // The box's depth (its "stretcher bar" thickness), as a fraction of
  // its own height — thin enough to read as canvas, not a brick.
  boxDepthRatio: 0.055,
  // Raw canvas edge — every face but the front, a warm off-white close
  // to unpainted linen/cotton duck.
  edgeColor: 0xe4d9bf,
  // Same convention as main.js's idleSpinSpeed: negative = clockwise
  // seen from above, in radians/sec. Matched to the same ~7min/turn pace
  // so the whole site's ambient motion feels like one language.
  idleSpinSpeed: -0.015,
  // Clamped so you can tilt to look over/under the piece without ever
  // flipping fully upside down or underneath it.
  minPolarAngle: Math.PI * 0.12,
  maxPolarAngle: Math.PI * 0.88,
  minZoomRatio: 0.5, // closest allowed distance, × the box's own radius
  maxZoomRatio: 3, // farthest allowed distance, × the box's own radius
};

const params = new URLSearchParams(location.search);
const piece = CANVASES.find((c) => c.id === params.get("piece")) || null;

const detailEl = document.getElementById("canvasDetail");
const notFoundEl = document.getElementById("canvasNotFound");

if (!piece) {
  if (notFoundEl) notFoundEl.hidden = false;
} else {
  runViewer(piece);
}

function runViewer(piece) {
  document.title = `Platon — ${piece.title}`;
  document.getElementById("canvasTitle").textContent = piece.title;
  document.getElementById("canvasMedium").textContent = piece.medium || "Canvas";
  renderGallery(piece);
  renderStencilTool(piece);
  detailEl.hidden = false;

  const stageEl = document.getElementById("canvasStage");
  const canvas = document.getElementById("canvasScene");
  const loadingEl = document.getElementById("canvasLoading");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); // fully transparent — the page's own background shows through
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = CONFIG.minPolarAngle;
  controls.maxPolarAngle = CONFIG.maxPolarAngle;
  controls.autoRotate = !prefersReducedMotion;
  // OrbitControls advances getAutoRotationAngle() = (2π/3600)×autoRotateSpeed
  // radians per update() call, and update() runs once per rendered frame —
  // at 60fps that's ×60 per second, so radians/sec = (2π/60)×autoRotateSpeed.
  // Solving for autoRotateSpeed converts CONFIG.idleSpinSpeed's radians/sec
  // (same unit main.js's idle spin uses) into whatever this expects.
  controls.autoRotateSpeed = (Math.abs(CONFIG.idleSpinSpeed) * 60) / (2 * Math.PI);

  let boxRadius = 1;
  let stageWidth = 1;
  let stageHeight = 1;
  let hasFramedOnce = false;

  function frameCameraToFit() {
    const halfFovY = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
    // Fit a sphere of the box's own radius into whichever axis is
    // tighter — using the radius (half the box's full diagonal) rather
    // than its resting width/height means this stays correct no matter
    // how the box has been rotated, since a sphere looks the same from
    // every angle.
    const minHalfFov = Math.min(halfFovY, halfFovX);
    const fitDistance = (boxRadius / Math.sin(minHalfFov)) * CONFIG.viewMargin;

    controls.minDistance = boxRadius * CONFIG.minZoomRatio;
    controls.maxDistance = boxRadius * CONFIG.maxZoomRatio;
    camera.near = Math.max(0.01, fitDistance / 100);
    camera.far = fitDistance * 4 + boxRadius * 2;
    camera.updateProjectionMatrix();

    // Only push the camera out to the fit distance if it isn't already
    // further out than that (keeps a user's current zoom level across a
    // resize instead of snapping back in).
    if (camera.position.length() < fitDistance || !hasFramedOnce) {
      camera.position.setLength(fitDistance);
      hasFramedOnce = true;
    }
  }

  function resize() {
    stageWidth = stageEl.clientWidth;
    stageHeight = stageEl.clientHeight;
    if (stageWidth <= 0 || stageHeight <= 0) return; // not laid out yet — the observer below fires again once it is
    renderer.setSize(stageWidth, stageHeight, false);
    camera.aspect = stageWidth / stageHeight;
    frameCameraToFit();
  }
  // A plain window "resize" listener only fires on the WINDOW's own size
  // changing — it stayed silent on the very first frame here, whenever
  // the stage's own layout (driven by CSS that may not have finished
  // applying yet at the moment this module ran) settled after this
  // script's initial synchronous pass, leaving the canvas sized 0×0
  // until an actual window resize happened to come along. A
  // ResizeObserver instead fires immediately with the stage's current
  // size AND on every later change, so there's no race to lose.
  new ResizeObserver(resize).observe(stageEl);

  canvas.addEventListener("pointerdown", () => canvas.classList.add("is-dragging"));
  window.addEventListener("pointerup", () => canvas.classList.remove("is-dragging"));

  new THREE.TextureLoader().load(
    canvasImageSrc(piece.mainImage),
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const aspect = texture.image.width / texture.image.height;
      const boxSize = new THREE.Vector3(aspect, 1, CONFIG.boxDepthRatio);
      boxRadius = boxSize.length() / 2;

      const edgeMaterial = new THREE.MeshBasicMaterial({ color: CONFIG.edgeColor });
      const frontMaterial = new THREE.MeshBasicMaterial({ map: texture });
      // BoxGeometry's material slots, in order: +x, -x, +y, -y, +z, -z.
      // The camera starts on +z (see camera.position above), so index 4
      // is the face actually facing the viewer at rest — every other
      // face, including the back, is the same flat edgeMaterial.
      const materials = [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, frontMaterial, edgeMaterial];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z), materials);
      scene.add(mesh);

      frameCameraToFit();
      if (loadingEl) loadingEl.hidden = true;
    },
    undefined,
    (err) => {
      console.info(`[canvas-viewer] Couldn't load "${piece.mainImage}".`, err);
      if (loadingEl) loadingEl.textContent = "Couldn't load this piece — try reloading.";
    }
  );

  function animate() {
    requestAnimationFrame(animate);
    controls.update(); // also advances autoRotate — needs calling every frame regardless of damping
    renderer.render(scene, camera);
  }
  animate();
}

function renderGallery(piece) {
  const container = document.getElementById("canvasDetailGrid");
  if (!container) return;
  const fragment = document.createDocumentFragment();
  piece.detailImages.forEach((relPath, i) => {
    const article = document.createElement("article");
    article.className = "card";

    const a = document.createElement("a");
    a.className = "card__frame";
    a.href = canvasImageSrc(relPath);
    a.target = "_blank";
    a.rel = "noopener";
    a.setAttribute("aria-label", `${piece.title} — detail ${i + 1}, open full size`);

    const img = document.createElement("img");
    img.src = canvasImageSrc(relPath);
    img.alt = `${piece.title} — detail ${i + 1}`;
    img.loading = "lazy";

    a.appendChild(img);
    article.appendChild(a);
    fragment.appendChild(article);
  });
  container.appendChild(fragment);
}

// Opt-in per piece (see js/canvas-data.js's stencilFont) — no-ops and
// leaves #stencilTool hidden for any piece that doesn't set one.
function renderStencilTool(piece) {
  if (!piece.stencilFont) return;
  const section = document.getElementById("stencilTool");
  const input = document.getElementById("stencilInput");
  const stampBtn = document.getElementById("stencilStampBtn");
  const preview = document.getElementById("stencilPreview");
  if (!section || !input || !stampBtn || !preview) return;

  preview.style.fontFamily = `"${piece.stencilFont}", var(--font-display)`;
  preview.textContent = piece.title;
  input.placeholder = piece.title;

  // A fresh small random tilt every press — a real hand-stamp never
  // lands perfectly level twice. CSS drives the spring-back transition
  // (see .stencil-tool__preview); this just picks the new angle.
  function stamp() {
    const angle = (Math.random() * 8 - 4).toFixed(2);
    preview.style.transform = `rotate(${angle}deg)`;
  }
  stamp();

  input.addEventListener("input", () => {
    preview.textContent = input.value.trim() || piece.title;
  });
  stampBtn.addEventListener("click", stamp);

  section.hidden = false;
}
