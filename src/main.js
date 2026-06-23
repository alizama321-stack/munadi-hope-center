import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const MODEL_ROOT = '/public/assets/models/optimized/';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPowerViewport = window.matchMedia('(max-width: 720px)').matches;
const debugMode = new URLSearchParams(window.location.search).has('debug');

const ASSETS = {
  door: `${MODEL_ROOT}wooden_church_door.glb`,
  interior: `${MODEL_ROOT}st_bartholomew-the-less_interior.glb`,
  lectern: `${MODEL_ROOT}lectern.glb`,
  closedBible: `${MODEL_ROOT}biblia.glb`,
  openBible: `${MODEL_ROOT}open_bible.glb`,
};

const BIBLE_TARGET_FOOTPRINT = 0.82;

// Scene transform constants for Phase 2 tuning.
const SCENE_TUNING = {
  // The church interior's longest model axis is local X; rotate it so that axis becomes the world Z nave path.
  interiorPosition: [0, 0, 0],
  interiorRotation: [0, -Math.PI / 2, 0],
  interiorHeight: 5.2,
  doorPosition: [0, 0, 8.6],
  doorRotation: [0, 0, 0],
  doorHeight: 4.65,
  lecternPosition: [0, 0, -6.45],
  lecternRotation: [0, 0, 0],
  lecternScale: 1.28,
  lecternSurfacePosition: [0, 1.76, 0.08],
  lecternSurfaceRotation: [0, 0, 0],
  lecternSurfaceSize: [1.34, 0.92],
  bibleRigPosition: [0, 0.018, 0],
  bibleRigRotation: [0, 0, 0],
  bibleRigScale: 0.92,
  closedBibleLocalRotation: [0, 0, 0],
  closedBibleLocalOffset: [0, 0, 0],
  closedBibleScale: 1,
  openBibleLocalRotation: [0, 0, 0],
  openBibleLocalOffset: [0, 0, 0],
  openBibleScale: 1,
};

const cameraWaypoints = [
  // entrance_pov: visitor POV outside the main wooden entrance.
  { name: 'entrance_pov', at: 0, camera: [0, 1.58, 11.8], target: [0, 1.48, 8.55] },
  // aisle_start: camera crosses the threshold and aligns with the center aisle.
  { name: 'aisle_start', at: 0.14, camera: [0, 1.58, 6.9], target: [0, 1.42, 1.4] },
  // aisle_mid: camera travels straight down the central nave/hallway.
  { name: 'aisle_mid', at: 0.32, camera: [0, 1.58, 1.9], target: [0, 1.34, -3.85] },
  // stage_approach: camera approaches the front/stage without cutting scenes.
  { name: 'stage_approach', at: 0.5, camera: [0, 1.64, -2.85], target: [0, 1.44, -6.45] },
  // lectern_stage: lectern is already placed on the front/stage and remains visible.
  { name: 'lectern_stage', at: 0.64, camera: [-2.24, 1.76, -4.35], target: [0, 1.66, -6.45] },
  // bible_cover_topdown: top-down view of the closed Bible cover on the lectern.
  { name: 'bible_cover_topdown', at: 0.82, camera: [-0.14, 3.95, -6.18], target: [0, 1.94, -6.42] },
  // bible_open_on_lectern: same lectern location, open model replaces closed model.
  { name: 'bible_open_on_lectern', at: 0.91, camera: [0, 4.2, -6.42], target: [0, 1.92, -6.45] },
  // bible_pages_content: HTML page overlays attach to the open spread.
  { name: 'bible_pages_content', at: 1, camera: [0, 4.35, -6.5], target: [0, 1.92, -6.45] },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mixVec3(a, b, t) {
  return new THREE.Vector3(mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t));
}

function toEuler(values) {
  return new THREE.Euler(values[0], values[1], values[2]);
}

function getTimelinePoint(progress) {
  const p = reducedMotion ? 0.82 : clamp(progress);
  let start = cameraWaypoints[0];
  let end = cameraWaypoints[cameraWaypoints.length - 1];

  for (let i = 0; i < cameraWaypoints.length - 1; i += 1) {
    if (p >= cameraWaypoints[i].at && p <= cameraWaypoints[i + 1].at) {
      start = cameraWaypoints[i];
      end = cameraWaypoints[i + 1];
      break;
    }
  }

  const local = smoothstep(start.at, end.at, p);
  return {
    name: local < 0.5 ? start.name : end.name,
    camera: mixVec3(start.camera, end.camera, local),
    target: mixVec3(start.target, end.target, local),
  };
}

function setStatus(message, state = '') {
  const status = document.getElementById('sceneStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function setOpacity(object, opacity) {
  object.visible = opacity > 0.01;
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = opacity < 0.999;
      material.opacity = opacity;
      material.depthWrite = opacity > 0.98;
    });
  });
}

function tuneMaterials(object, options = {}) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      material.envMapIntensity = options.envMapIntensity ?? 0.7;
      if ('roughness' in material) material.roughness = Math.max(material.roughness ?? 0.65, options.roughness ?? 0.72);
      if ('metalness' in material && options.metalness !== undefined) material.metalness = options.metalness;
      if (options.opacity !== undefined) {
        material.transparent = true;
        material.opacity = options.opacity;
      }
      if (options.clippingPlanes) {
        material.clippingPlanes = options.clippingPlanes;
        material.clipIntersection = true;
      }
      material.needsUpdate = true;
    });
  });
}

function normalizeToGround(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= box.min.y;
  return object;
}

function normalizeToHeight(object, targetHeight) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  object.scale.setScalar(targetHeight / Math.max(0.001, size.y));
  return normalizeToGround(object);
}

function normalizeFootprint(object, targetWidth) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  object.scale.setScalar(targetWidth / Math.max(0.001, size.x));
  return normalizeToGround(object);
}

function eulerToArray(euler) {
  return [euler.x, euler.y, euler.z].map((value) => Number(value.toFixed(4)));
}

function measureObject(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}

function findFlatBibleOrientation(model, label) {
  const turns = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let best = null;

  turns.forEach((x) => {
    turns.forEach((y) => {
      turns.forEach((z) => {
        const probe = model.clone(true);
        probe.rotation.set(x, y, z);
        const { size } = measureObject(probe);
        const largest = Math.max(size.x, size.y, size.z, 0.001);
        const smallest = Math.min(size.x, size.y, size.z);
        const yShouldBeThickness = Math.abs(size.y - smallest) / largest;
        const lengthShouldBeZ = size.z >= size.x ? 0 : (size.x - size.z) / largest;
        const score = yShouldBeThickness * 8 + lengthShouldBeZ;
        const candidate = { rotation: new THREE.Euler(x, y, z), size, score };
        if (!best || candidate.score < best.score) best = candidate;
      });
    });
  });

  console.info(`[BibleRig] ${label} bounding-box orientation`, {
    rotation: eulerToArray(best.rotation),
    size: [best.size.x, best.size.y, best.size.z].map((value) => Number(value.toFixed(4))),
    score: Number(best.score.toFixed(4)),
  });

  return best.rotation;
}

function normalizeBibleModel(rawModel, label, config) {
  const model = rawModel;
  const autoRotation = findFlatBibleOrientation(model, label);
  const root = new THREE.Group();
  root.name = `${label}NormalizedRoot`;
  const localRotation = toEuler(config.localRotation);

  model.position.set(0, 0, 0);
  model.rotation.copy(autoRotation);
  model.scale.setScalar(1);
  const rotatedSize = measureObject(model).size;
  const footprintScale = BIBLE_TARGET_FOOTPRINT / Math.max(rotatedSize.x, rotatedSize.z, 0.001);
  model.scale.setScalar(footprintScale);

  const { box, size, center } = measureObject(model);
  model.position.x += -center.x;
  model.position.y += -box.min.y;
  model.position.z += -center.z;

  root.position.fromArray(config.localOffset);
  root.rotation.copy(localRotation);
  root.scale.setScalar(config.scale);
  root.add(model);
  measureObject(root);

  console.info(`[BibleRig] ${label} normalized bounds`, {
    autoRotation: eulerToArray(autoRotation),
    localRotation: config.localRotation,
    localOffset: config.localOffset,
    localScale: config.scale,
    footprintScale: Number(footprintScale.toFixed(4)),
    sourceSize: [size.x, size.y, size.z].map((value) => Number(value.toFixed(4))),
  });

  tuneMaterials(model, { envMapIntensity: config.envMapIntensity, roughness: config.roughness });
  return root;
}

function createLecternSurfaceHelper(size) {
  const helper = new THREE.Group();
  helper.name = 'LecternSurfaceHelper';
  helper.visible = debugMode;

  const [width, depth] = size;
  const grid = new THREE.GridHelper(1, 8, '#f0c975', '#7f4a22');
  grid.scale.set(width, 1, depth);
  grid.material.transparent = true;
  grid.material.opacity = 0.58;
  helper.add(grid);

  const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-width / 2, 0.006, -depth / 2),
    new THREE.Vector3(width / 2, 0.006, -depth / 2),
    new THREE.Vector3(width / 2, 0.006, depth / 2),
    new THREE.Vector3(-width / 2, 0.006, depth / 2),
    new THREE.Vector3(-width / 2, 0.006, -depth / 2),
  ]);
  const outline = new THREE.Line(
    outlineGeometry,
    new THREE.LineBasicMaterial({ color: '#f0c975', transparent: true, opacity: 0.88 }),
  );
  helper.add(outline);

  return helper;
}

function createOpeningRig() {
  const group = new THREE.Group();
  group.name = 'ProceduralOpeningRig';

  const coverMaterial = new THREE.MeshStandardMaterial({
    color: '#160b08',
    roughness: 0.84,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const pageMaterial = new THREE.MeshStandardMaterial({
    color: '#f1dfb7',
    roughness: 0.9,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: '#c9952e',
    roughness: 0.48,
    metalness: 0.5,
    side: THREE.DoubleSide,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.055, 0.72), pageMaterial);
  base.position.y = 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const backCover = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.03, 0.76), coverMaterial);
  backCover.position.y = 0.014;
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  group.add(backCover);

  const coverHinge = new THREE.Group();
  coverHinge.name = 'OpeningCoverHinge';
  coverHinge.position.set(-0.56, 0.075, 0);
  const frontCover = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.028, 0.76), coverMaterial);
  frontCover.position.x = 0.56;
  frontCover.castShadow = true;
  frontCover.receiveShadow = true;
  coverHinge.add(frontCover);
  const goldLine = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.006, 0.012), goldMaterial);
  goldLine.position.set(0.56, 0.02, -0.28);
  coverHinge.add(goldLine);
  group.add(coverHinge);

  const pageHinges = [];
  for (let i = 0; i < 5; i += 1) {
    const hinge = new THREE.Group();
    hinge.name = `OpeningPageHinge_${i + 1}`;
    hinge.position.set(-0.52, 0.087 + i * 0.004, 0);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(1.02 - i * 0.025, 0.68), pageMaterial.clone());
    page.rotation.x = -Math.PI / 2;
    page.position.x = 0.51 - i * 0.012;
    page.castShadow = true;
    page.receiveShadow = true;
    hinge.add(page);
    pageHinges.push(hinge);
    group.add(hinge);
  }

  group.userData.updateOpening = (progress) => {
    const p = smoothstep(0, 1, progress);
    coverHinge.rotation.z = -p * 2.35;
    pageHinges.forEach((hinge, index) => {
      const delay = index * 0.08;
      const pageProgress = smoothstep(delay, 1, p);
      hinge.rotation.z = -pageProgress * (1.25 + index * 0.16);
      hinge.rotation.x = Math.sin(p * Math.PI + index) * 0.018;
    });
  };

  return group;
}

function createPageAnchorGroup() {
  const group = new THREE.Group();
  group.name = 'BiblePageAnchor';
  group.position.set(0, 0.11, 0);
  return group;
}

function applyRigTransform(group, values) {
  group.position.fromArray(values.position);
  group.rotation.copy(toEuler(values.rotation));
  group.scale.setScalar(values.scale);
}

function createCalibrationPanel({ lecternSurface, bibleRig, closedModel, openModel }) {
  if (!debugMode) return;

  const panel = document.createElement('div');
  panel.className = 'calibration-panel debug-only';
  panel.innerHTML = `
    <strong>BibleRig calibration</strong>
    <label>surface X <input data-bind="surface.position.x" type="number" step="0.01"></label>
    <label>surface Y <input data-bind="surface.position.y" type="number" step="0.01"></label>
    <label>surface Z <input data-bind="surface.position.z" type="number" step="0.01"></label>
    <label>rig X <input data-bind="rig.position.x" type="number" step="0.01"></label>
    <label>rig Y <input data-bind="rig.position.y" type="number" step="0.005"></label>
    <label>rig Z <input data-bind="rig.position.z" type="number" step="0.01"></label>
    <label>rig rot X <input data-bind="rig.rotation.x" type="number" step="1"></label>
    <label>rig rot Y <input data-bind="rig.rotation.y" type="number" step="1"></label>
    <label>rig rot Z <input data-bind="rig.rotation.z" type="number" step="1"></label>
    <label>rig scale <input data-bind="rig.scale" type="number" step="0.01"></label>
    <label>closed off X <input data-bind="closed.position.x" type="number" step="0.01"></label>
    <label>closed off Z <input data-bind="closed.position.z" type="number" step="0.01"></label>
    <label>closed rot Y <input data-bind="closed.rotation.y" type="number" step="1"></label>
    <label>closed scale <input data-bind="closed.scale" type="number" step="0.01"></label>
    <label>open off X <input data-bind="open.position.x" type="number" step="0.01"></label>
    <label>open off Z <input data-bind="open.position.z" type="number" step="0.01"></label>
    <label>open rot Y <input data-bind="open.rotation.y" type="number" step="1"></label>
    <label>open scale <input data-bind="open.scale" type="number" step="0.01"></label>
    <button type="button" data-print>Print transforms</button>
    <small>Keys: arrows move X/Z, PageUp/PageDown move Y, [ ] rotate Y, - = scale, P prints.</small>
  `;
  document.body.appendChild(panel);

  const bindings = {
    'surface.position.x': {
      get: () => lecternSurface.position.x,
      set: (value) => { lecternSurface.position.x = value; },
    },
    'surface.position.y': {
      get: () => lecternSurface.position.y,
      set: (value) => { lecternSurface.position.y = value; },
    },
    'surface.position.z': {
      get: () => lecternSurface.position.z,
      set: (value) => { lecternSurface.position.z = value; },
    },
    'rig.position.x': {
      get: () => bibleRig.position.x,
      set: (value) => { bibleRig.position.x = value; },
    },
    'rig.position.y': {
      get: () => bibleRig.position.y,
      set: (value) => { bibleRig.position.y = value; },
    },
    'rig.position.z': {
      get: () => bibleRig.position.z,
      set: (value) => { bibleRig.position.z = value; },
    },
    'rig.rotation.x': {
      get: () => THREE.MathUtils.radToDeg(bibleRig.rotation.x),
      set: (value) => { bibleRig.rotation.x = THREE.MathUtils.degToRad(value); },
    },
    'rig.rotation.y': {
      get: () => THREE.MathUtils.radToDeg(bibleRig.rotation.y),
      set: (value) => { bibleRig.rotation.y = THREE.MathUtils.degToRad(value); },
    },
    'rig.rotation.z': {
      get: () => THREE.MathUtils.radToDeg(bibleRig.rotation.z),
      set: (value) => { bibleRig.rotation.z = THREE.MathUtils.degToRad(value); },
    },
    'rig.scale': {
      get: () => bibleRig.scale.x,
      set: (value) => { bibleRig.scale.setScalar(value); },
    },
    'closed.position.x': {
      get: () => closedModel?.position.x ?? 0,
      set: (value) => { if (closedModel) closedModel.position.x = value; },
    },
    'closed.position.z': {
      get: () => closedModel?.position.z ?? 0,
      set: (value) => { if (closedModel) closedModel.position.z = value; },
    },
    'closed.rotation.y': {
      get: () => closedModel ? THREE.MathUtils.radToDeg(closedModel.rotation.y) : 0,
      set: (value) => { if (closedModel) closedModel.rotation.y = THREE.MathUtils.degToRad(value); },
    },
    'closed.scale': {
      get: () => closedModel?.scale.x ?? 1,
      set: (value) => { if (closedModel) closedModel.scale.setScalar(value); },
    },
    'open.position.x': {
      get: () => openModel?.position.x ?? 0,
      set: (value) => { if (openModel) openModel.position.x = value; },
    },
    'open.position.z': {
      get: () => openModel?.position.z ?? 0,
      set: (value) => { if (openModel) openModel.position.z = value; },
    },
    'open.rotation.y': {
      get: () => openModel ? THREE.MathUtils.radToDeg(openModel.rotation.y) : 0,
      set: (value) => { if (openModel) openModel.rotation.y = THREE.MathUtils.degToRad(value); },
    },
    'open.scale': {
      get: () => openModel?.scale.x ?? 1,
      set: (value) => { if (openModel) openModel.scale.setScalar(value); },
    },
  };

  function printTransforms() {
    const payload = {
      lecternSurfacePosition: lecternSurface.position.toArray().map((value) => Number(value.toFixed(4))),
      lecternSurfaceRotation: eulerToArray(lecternSurface.rotation),
      bibleRigPosition: bibleRig.position.toArray().map((value) => Number(value.toFixed(4))),
      bibleRigRotation: eulerToArray(bibleRig.rotation),
      bibleRigScale: Number(bibleRig.scale.x.toFixed(4)),
      closedBibleLocalRotation: closedModel ? eulerToArray(closedModel.rotation) : null,
      closedBibleLocalOffset: closedModel ? closedModel.position.toArray().map((value) => Number(value.toFixed(4))) : null,
      closedBibleScale: closedModel ? Number(closedModel.scale.x.toFixed(4)) : null,
      openBibleLocalRotation: openModel ? eulerToArray(openModel.rotation) : null,
      openBibleLocalOffset: openModel ? openModel.position.toArray().map((value) => Number(value.toFixed(4))) : null,
      openBibleScale: openModel ? Number(openModel.scale.x.toFixed(4)) : null,
    };
    console.info('[BibleRig] calibration values', payload);
    return payload;
  }

  function refreshInputs() {
    panel.querySelectorAll('input[data-bind]').forEach((input) => {
      const binding = bindings[input.dataset.bind];
      input.value = Number(binding.get().toFixed(4));
    });
  }

  panel.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-bind]');
    if (!input) return;
    bindings[input.dataset.bind].set(Number(input.value));
  });

  panel.querySelector('[data-print]').addEventListener('click', printTransforms);

  window.addEventListener('keydown', (event) => {
    if (!debugMode || event.target.closest('input, textarea, select')) return;
    const move = event.shiftKey ? 0.05 : 0.015;
    const turn = THREE.MathUtils.degToRad(event.shiftKey ? 5 : 1);
    const scaleStep = event.shiftKey ? 0.05 : 0.01;

    if (event.key === 'ArrowLeft') bibleRig.position.x -= move;
    else if (event.key === 'ArrowRight') bibleRig.position.x += move;
    else if (event.key === 'ArrowUp') bibleRig.position.z -= move;
    else if (event.key === 'ArrowDown') bibleRig.position.z += move;
    else if (event.key === 'PageUp') bibleRig.position.y += move;
    else if (event.key === 'PageDown') bibleRig.position.y -= move;
    else if (event.key === '[') bibleRig.rotation.y -= turn;
    else if (event.key === ']') bibleRig.rotation.y += turn;
    else if (event.key === '-') bibleRig.scale.setScalar(Math.max(0.1, bibleRig.scale.x - scaleStep));
    else if (event.key === '=') bibleRig.scale.setScalar(bibleRig.scale.x + scaleStep);
    else if (event.key.toLowerCase() === 'p') printTransforms();
    else return;

    event.preventDefault();
    refreshInputs();
  });

  refreshInputs();
  window.__MUNADI_BIBLE_RIG__ = { lecternSurface, bibleRig, printTransforms, refreshInputs };
}

function makeAisle() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 21, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#241008', roughness: 0.96 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.8;
  floor.receiveShadow = true;
  group.add(floor);

  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 20.5, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#521b10', roughness: 0.92, transparent: true, opacity: 0.78 }),
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.012, 0.55);
  group.add(runner);

  for (let i = 0; i < 6; i += 1) {
    const z = 5.4 - i * 2.75;
    [-2.85, 2.85].forEach((x) => {
      const pew = new THREE.Mesh(
        new THREE.BoxGeometry(1.9, 0.2, 0.46),
        new THREE.MeshStandardMaterial({ color: '#321207', roughness: 0.9 }),
      );
      pew.position.set(x, 0.42, z);
      pew.castShadow = true;
      pew.receiveShadow = true;
      group.add(pew);
    });
  }

  return group;
}

function makeCentralHallMask() {
  const group = new THREE.Group();
  const sideMaterial = new THREE.MeshBasicMaterial({
    color: '#120503',
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ceilingMaterial = new THREE.MeshBasicMaterial({
    color: '#120503',
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  [-1.42, 1.42].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(19, 4.4), sideMaterial);
    wall.position.set(x, 2.2, -0.2);
    wall.rotation.y = Math.PI / 2;
    group.add(wall);
  });

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 19), ceilingMaterial);
  ceiling.position.set(0, 4.2, -0.2);
  ceiling.rotation.x = Math.PI / 2;
  group.add(ceiling);

  return group;
}

function createDust() {
  const count = lowPowerViewport ? 90 : 180;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 7.4;
    positions[i * 3 + 1] = 0.8 + Math.random() * 3.4;
    positions[i * 3 + 2] = -7.5 + Math.random() * 18;
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 0.78 + Math.random() * 0.16;
    colors[i * 3 + 2] = 0.38 + Math.random() * 0.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: lowPowerViewport ? 0.022 : 0.016,
      transparent: true,
      opacity: 0.36,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

function createDebugLabels(container) {
  return cameraWaypoints.map((waypoint) => {
    const label = document.createElement('div');
    label.className = 'debug-label';
    label.textContent = waypoint.name;
    container.appendChild(label);
    return { label, waypoint };
  });
}

function updateDebugLabels(labels, camera) {
  if (!labels.length) return;
  labels.forEach(({ label, waypoint }) => {
    const projected = new THREE.Vector3().fromArray(waypoint.target).project(camera);
    const visible = projected.z > -1 && projected.z < 1;
    label.style.opacity = visible ? '1' : '0';
    label.style.left = `${(projected.x * 0.5 + 0.5) * window.innerWidth}px`;
    label.style.top = `${(-projected.y * 0.5 + 0.5) * window.innerHeight}px`;
  });
}

async function loadModel(loader, key, path, required = true) {
  try {
    const gltf = await loader.loadAsync(path);
    return { key, model: gltf.scene, error: null };
  } catch (error) {
    if (required) setStatus(`Scene asset failed to load: ${key}. Check ${path}`, 'error');
    return { key, model: null, error };
  }
}

function updateHeroOverlay(progress) {
  const heroCopy = document.getElementById('heroCopy');
  const label = document.getElementById('timelineLabel');

  const heroIn = smoothstep(0.52, 0.63, progress);
  const heroOut = smoothstep(0.76, 0.86, progress);
  const heroOpacity = reducedMotion ? 1 : heroIn * (1 - heroOut);

  if (heroCopy) {
    heroCopy.style.opacity = String(heroOpacity);
    heroCopy.style.transform = `translate3d(0, ${mix(28, -42, heroOut)}px, 0)`;
    heroCopy.style.pointerEvents = heroOpacity > 0.5 ? 'auto' : 'none';
  }

  if (label) {
    const point = getTimelinePoint(progress);
    label.textContent = debugMode ? `${Math.round(progress * 100)}% - ${point.name}` : point.name.replaceAll('_', ' ');
  }
}

function updatePageOverlay(progress, camera, pageAnchorGroup) {
  const overlay = document.getElementById('pageContentOverlay');
  if (!overlay || !pageAnchorGroup) return;

  const overlayOpacity = smoothstep(0.948, 0.99, progress);
  overlay.style.setProperty('--page-overlay-opacity', String(reducedMotion ? 1 : overlayOpacity));

  if (lowPowerViewport) {
    overlay.style.left = '50%';
    overlay.style.top = '55%';
    overlay.style.width = 'min(360px, calc(100vw - 1.5rem))';
    overlay.style.setProperty('--page-tilt', '0deg');
    return;
  }

  const anchors = [
    new THREE.Vector3(-0.56, 0.1, -0.34),
    new THREE.Vector3(0.56, 0.1, -0.34),
    new THREE.Vector3(-0.56, 0.1, 0.34),
    new THREE.Vector3(0.56, 0.1, 0.34),
  ].map((point) => pageAnchorGroup.localToWorld(point.clone()).project(camera));

  const xs = anchors.map((point) => (point.x * 0.5 + 0.5) * window.innerWidth);
  const ys = anchors.map((point) => (-point.y * 0.5 + 0.5) * window.innerHeight);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const width = clamp((right - left) * 0.64, 360, 520);
  const height = clamp((bottom - top) * 0.82, 180, 300);

  overlay.style.left = `${(left + right) / 2}px`;
  overlay.style.top = `${(top + bottom) / 2 + height * 0.08}px`;
  overlay.style.width = `${width}px`;
  overlay.style.setProperty('--page-tilt', '-11deg');
  overlay.style.maxHeight = `${height}px`;
}

async function setupScene() {
  const canvas = document.getElementById('sceneCanvas');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPowerViewport,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPowerViewport ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !lowPowerViewport;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#180806');
  scene.fog = new THREE.FogExp2('#190806', lowPowerViewport ? 0.074 : 0.048);

  const camera = new THREE.PerspectiveCamera(lowPowerViewport ? 44 : 38, 1, 0.1, 80);
  const target = new THREE.Vector3();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  scene.add(new THREE.HemisphereLight('#fff0c8', '#120503', 1.08));
  const key = new THREE.DirectionalLight('#ffd38d', 2.4);
  key.position.set(-4, 7, 9);
  key.castShadow = !lowPowerViewport;
  scene.add(key);

  const sanctuaryGlow = new THREE.SpotLight('#f0ad5a', 4.1, 28, 0.34, 0.76, 1.2);
  sanctuaryGlow.position.set(1.4, 5.3, -3.4);
  sanctuaryGlow.target.position.set(0, 1.1, -6.35);
  sanctuaryGlow.castShadow = !lowPowerViewport;
  scene.add(sanctuaryGlow, sanctuaryGlow.target);

  const doorGlow = new THREE.PointLight('#ffc271', 2.5, 12, 1.6);
  doorGlow.position.set(0, 2.2, 8.3);
  scene.add(doorGlow);

  const world = new THREE.Group();
  scene.add(world);
  world.add(makeAisle());
  const hallMask = makeCentralHallMask();
  world.add(hallMask);

  const dust = createDust();
  scene.add(dust);

  const results = await Promise.all([
    loadModel(loader, 'door', ASSETS.door),
    lowPowerViewport ? Promise.resolve({ key: 'interior', model: null, skipped: true }) : loadModel(loader, 'interior', ASSETS.interior, false),
    loadModel(loader, 'lectern', ASSETS.lectern),
    loadModel(loader, 'closedBible', ASSETS.closedBible),
    loadModel(loader, 'openBible', ASSETS.openBible),
  ]);

  const loaded = Object.fromEntries(results.map((result) => [result.key, result]));
  const failures = results.filter((result) => result.error);
  if (failures.length) {
    setStatus(`Loaded with ${failures.length} asset issue${failures.length > 1 ? 's' : ''}. See console for details.`, 'error');
    failures.forEach((failure) => console.error(`Failed to load ${failure.key}`, failure.error));
  } else {
    setStatus(lowPowerViewport ? 'Mobile scene loaded with lighter environment.' : 'Church scene loaded.', 'ready');
  }

  let interior = null;
  if (loaded.interior?.model) {
    interior = normalizeToHeight(loaded.interior.model, SCENE_TUNING.interiorHeight);
    const centerAisleClip = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), 1.85),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1.85),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.05),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 8.2),
    ];
    tuneMaterials(interior, {
      envMapIntensity: 0.28,
      roughness: 0.92,
      opacity: 0.07,
      clippingPlanes: centerAisleClip,
    });
    interior.position.fromArray(SCENE_TUNING.interiorPosition);
    interior.rotation.copy(toEuler(SCENE_TUNING.interiorRotation));
    world.add(interior);
  }

  let door = null;
  if (loaded.door?.model) {
    door = normalizeToHeight(loaded.door.model, SCENE_TUNING.doorHeight);
    tuneMaterials(door, { envMapIntensity: 0.42, roughness: 0.84 });
    door.position.fromArray(SCENE_TUNING.doorPosition);
    door.rotation.copy(toEuler(SCENE_TUNING.doorRotation));
    world.add(door);
  }

  const lecternRig = new THREE.Group();
  lecternRig.position.fromArray(SCENE_TUNING.lecternPosition);
  lecternRig.rotation.copy(toEuler(SCENE_TUNING.lecternRotation));
  world.add(lecternRig);

  if (loaded.lectern?.model) {
    const lectern = normalizeToGround(loaded.lectern.model);
    lectern.scale.setScalar(SCENE_TUNING.lecternScale);
    tuneMaterials(lectern, { envMapIntensity: 0.68, roughness: 0.72 });
    lecternRig.add(lectern);
  }

  const lecternSurface = new THREE.Group();
  lecternSurface.name = 'LecternSurface';
  lecternSurface.position.fromArray(SCENE_TUNING.lecternSurfacePosition);
  lecternSurface.rotation.copy(toEuler(SCENE_TUNING.lecternSurfaceRotation));
  lecternRig.add(lecternSurface);

  const [surfaceWidth, surfaceDepth] = SCENE_TUNING.lecternSurfaceSize;
  const surfacePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(surfaceWidth, surfaceDepth),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  surfacePlane.name = 'LecternSurfacePlane';
  surfacePlane.rotation.x = -Math.PI / 2;
  surfacePlane.visible = false;
  lecternSurface.add(surfacePlane, createLecternSurfaceHelper(SCENE_TUNING.lecternSurfaceSize));

  const bibleRig = new THREE.Group();
  bibleRig.name = 'BibleRig';
  bibleRig.position.fromArray(SCENE_TUNING.bibleRigPosition);
  bibleRig.rotation.copy(toEuler(SCENE_TUNING.bibleRigRotation));
  bibleRig.scale.setScalar(SCENE_TUNING.bibleRigScale);
  lecternSurface.add(bibleRig);

  const closedBibleGroup = new THREE.Group();
  closedBibleGroup.name = 'ClosedBibleSlot';
  const openBibleGroup = new THREE.Group();
  openBibleGroup.name = 'OpenBibleSlot';
  const fakeOpeningGroup = createOpeningRig();
  const pageAnchorGroup = createPageAnchorGroup();
  bibleRig.add(closedBibleGroup, openBibleGroup, fakeOpeningGroup, pageAnchorGroup);
  setOpacity(fakeOpeningGroup, 0);

  let closedBible = null;
  if (loaded.closedBible?.model) {
    closedBible = normalizeBibleModel(loaded.closedBible.model, 'closedBible', {
      localRotation: SCENE_TUNING.closedBibleLocalRotation,
      localOffset: SCENE_TUNING.closedBibleLocalOffset,
      scale: SCENE_TUNING.closedBibleScale,
      envMapIntensity: 0.96,
      roughness: 0.76,
    });
    closedBibleGroup.add(closedBible);
  }

  let openBible = null;
  if (loaded.openBible?.model) {
    openBible = normalizeBibleModel(loaded.openBible.model, 'openBible', {
      localRotation: SCENE_TUNING.openBibleLocalRotation,
      localOffset: SCENE_TUNING.openBibleLocalOffset,
      scale: SCENE_TUNING.openBibleScale,
      envMapIntensity: 0.92,
      roughness: 0.78,
    });
    openBibleGroup.add(openBible);
    setOpacity(openBibleGroup, 0);
  }

  createCalibrationPanel({ lecternSurface, bibleRig, closedModel: closedBible, openModel: openBible });

  const debugContainer = document.body;
  const debugLabels = createDebugLabels(debugContainer);
  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function scrollProgress() {
    if (reducedMotion) return 0.96;
    const journey = document.getElementById('journey');
    if (!journey) return 0;
    const rect = journey.getBoundingClientRect();
    const max = Math.max(1, journey.offsetHeight - window.innerHeight);
    return clamp(-rect.top / max);
  }

  let desiredProgress = scrollProgress();
  let renderedProgress = desiredProgress;
  let last = performance.now();

  function updateScene(progress) {
    const point = getTimelinePoint(progress);
    camera.position.copy(point.camera);
    target.copy(point.target);
    camera.lookAt(target);

    const openingProgress = smoothstep(0.855, 0.922, progress);
    const fakeOpeningOpacity = smoothstep(0.835, 0.86, progress) * (1 - smoothstep(0.928, 0.966, progress));
    fakeOpeningGroup.userData.updateOpening(openingProgress);
    setOpacity(closedBibleGroup, 1 - smoothstep(0.855, 0.878, progress));
    setOpacity(fakeOpeningGroup, fakeOpeningOpacity);
    setOpacity(openBibleGroup, smoothstep(0.928, 0.966, progress));
    if (door) setOpacity(door, 1 - smoothstep(0.08, 0.2, progress));
    if (interior) setOpacity(interior, mix(0.07, 0.012, smoothstep(0.16, 0.5, progress)));
    hallMask.visible = progress < 0.62;

    sanctuaryGlow.intensity = mix(3.2, 5.4, smoothstep(0.78, 0.98, progress));
    doorGlow.intensity = mix(2.5, 0.42, smoothstep(0.08, 0.34, progress));
    dust.position.z = mix(0, -1, progress);

    updateHeroOverlay(progress);
    updatePageOverlay(progress, camera, pageAnchorGroup);
    updateDebugLabels(debugLabels, camera);
  }

  function render(now) {
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    desiredProgress = scrollProgress();
    renderedProgress = THREE.MathUtils.damp(renderedProgress, desiredProgress, reducedMotion ? 18 : 12, delta);
    dust.rotation.y += delta * 0.016;
    updateScene(renderedProgress);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', () => {
    desiredProgress = scrollProgress();
  }, { passive: true });

  updateScene(desiredProgress);
  requestAnimationFrame(render);
}

function setupNavSpy() {
  const links = document.querySelectorAll('.links a[data-nav]');
  const sections = document.querySelectorAll('main .chapter');
  if (!links.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => link.classList.remove('active'));
      const match = document.querySelector(`.links a[data-nav="${entry.target.id}"]`);
      if (match) match.classList.add('active');
    });
  }, { threshold: 0.35 });

  sections.forEach((section) => observer.observe(section));
}

function setupAnchorNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      event.preventDefault();
      history.pushState(null, '', hash);

      if (link.dataset.scrollEnd === 'true') {
        const journey = document.getElementById('journey');
        const max = journey.offsetHeight - window.innerHeight;
        window.scrollTo({ top: max, behavior: reducedMotion ? 'auto' : 'smooth' });
        return;
      }

      if (link.dataset.scrollDebug === 'true') {
        document.documentElement.classList.add('debug-scene');
      }

      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

document.documentElement.classList.toggle('debug-scene', debugMode);
document.documentElement.style.scrollBehavior = reducedMotion ? 'auto' : 'smooth';

setupScene();
setupNavSpy();
setupAnchorNavigation();
