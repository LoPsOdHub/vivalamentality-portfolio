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
        aspect ratio once it's loaded (see buildCanvasMesh).
     3. Wires up OrbitControls so dragging turns the piece freely in any
        direction (not just left/right, unlike the home hero's model) and
        scroll/pinch zooms in on it — this page's whole point is letting
        you get close to one piece, so there's no reason to hold back the
        vertical axis the way the hero does.
     4. A slow constant idle rotation, same idea and speed as the home
        hero's (js/main.js CONFIG.idleSpinSpeed) — off entirely under
        prefers-reduced-motion.
     5. Renders the piece's detailImages as a plain grid below the
        viewer, each linking to the full photo in a new tab.
   ========================================================================== */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CANVASES, canvasImageSrc } from "./canvas-data.js?v=1";

const CONFIG = {
  cameraFov: 32,
  // How much of the stage's limiting dimension the box should span —
  // same idea as main.js's fillFraction.
  fillFraction: 1.15,
  // The box's depth (its "stretcher bar" thickness), as a fraction of
  // its own height — thin enough to read as canvas, not a brick.
  boxDepthRatio: 0.045,
  // Raw canvas edge — the box's five non-photo faces (sides/back), a
  // warm off-white close to unpainted linen/cotton duck.
  edgeColor: 0xd9cdae,
  // Same convention as main.js's idleSpinSpeed: negative = clockwise
  // seen from above, in radians/sec. Matched to the same ~7min/turn pace
  // so the whole site's ambient motion feels like one language.
  idleSpinSpeed: -0.015,
  // Clamped so you can tilt to look over/under the piece without ever
  // flipping fully upside down or underneath it.
  minPolarAngle: Math.PI * 0.12,
  maxPolarAngle: Math.PI * 0.88,
  minZoomRatio: 0.55, // closest allowed distance, × the box's own diagonal
  maxZoomRatio: 2.4, // farthest allowed distance, × the box's own diagonal
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
  detailEl.hidden = false;

  const stageEl = document.getElementById("canvasStage");
  const canvas = document.getElementById("canvasScene");
  const loadingEl = document.getElementById("canvasLoading");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

  const keyLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xffe3cc, 0.5);
  rimLight.position.set(-4, 2, -3);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

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

  let boxSize = new THREE.Vector3(1, 1, 1);
  let stageWidth = 1;
  let stageHeight = 1;

  function frameCameraToFit() {
    const halfFovY = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfFovX = Math.atan(Math.tan(halfFovY) * camera.aspect);
    const distForHeight = boxSize.y / 2 / Math.tan(halfFovY);
    const distForWidth = boxSize.x / 2 / Math.tan(halfFovX);
    const fitDistance = Math.max(distForHeight, distForWidth) / CONFIG.fillFraction + boxSize.z / 2;

    const diagonal = boxSize.length() || 1;
    controls.minDistance = diagonal * CONFIG.minZoomRatio;
    controls.maxDistance = diagonal * CONFIG.maxZoomRatio;
    camera.near = Math.max(0.01, fitDistance / 100);
    camera.far = fitDistance * 4 + diagonal;
    camera.updateProjectionMatrix();

    // Only push the camera out to the fit distance if it isn't already
    // further out than that (keeps a user's current zoom level across a
    // resize instead of snapping back in).
    if (camera.position.length() < fitDistance || !hasFramedOnce) {
      camera.position.setLength(fitDistance);
      hasFramedOnce = true;
    }
  }
  let hasFramedOnce = false;

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
      boxSize = new THREE.Vector3(aspect, 1, CONFIG.boxDepthRatio);

      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: CONFIG.edgeColor,
        roughness: 0.92,
        metalness: 0,
      });
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0,
      });
      // BoxGeometry's material slots, in order: +x, -x, +y, -y, +z, -z.
      // The camera starts on +z (see camera.position above), so index 4
      // is the face actually facing the viewer at rest.
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
