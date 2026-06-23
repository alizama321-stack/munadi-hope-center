import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ASSETS = {
  book: '/public/assets/models/book_animated_book__historical_book.glb',
  lectern: '/public/assets/models/optimized/lectern.glb',
};

const LOCKED_BOOK_TRANSFORM = {
  position: [0, 2.03, 0.03],
  rotation: [0, 0, 180],
  scale: 0.32,
};

const LOCKED_LECTERN_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  targetHeight: 2.05,
};

const LOCKED_DECAL_TRANSFORM = {
  coverTarget: 'cover-l_36',
  coverFace: -1,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1.02, 1.02],
};

const OPEN_CLIP_TIME_RATIO = 0.5;

const CAMERA_PRESETS = {
  hero_view: {
    position: [2.35, 4.55, 3.45],
    target: [0, 2.02, 0],
    fov: 38,
  },
  cover_closeup: {
    position: [0.95, 2.95, 1.25],
    target: [0, 2.06, 0.02],
    fov: 30,
  },
  open_pages_view: {
    position: [0.12, 3.32, 0.48],
    target: [0, 2.08, 0.02],
    fov: 24,
  },
};

const PAGE_ANCHORS = [
  new THREE.Vector3(-1.92, -0.46, -1.13),
  new THREE.Vector3(1.92, -0.46, -1.13),
  new THREE.Vector3(-1.92, -0.46, 1.13),
  new THREE.Vector3(1.92, -0.46, 1.13),
];

const DEFAULTS = {
  coverTarget: LOCKED_DECAL_TRANSFORM.coverTarget,
  coverFace: LOCKED_DECAL_TRANSFORM.coverFace,
  book: structuredClone(LOCKED_BOOK_TRANSFORM),
  decal: {
    position: [...LOCKED_DECAL_TRANSFORM.position],
    rotation: [...LOCKED_DECAL_TRANSFORM.rotation],
    scale: [...LOCKED_DECAL_TRANSFORM.scale],
  },
};

const state = structuredClone(DEFAULTS);
const status = document.getElementById('status');
const canvas = document.getElementById('bookLabCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#140604');
scene.fog = new THREE.FogExp2('#140604', 0.035);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
camera.position.fromArray(CAMERA_PRESETS.hero_view.position);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(CAMERA_PRESETS.hero_view.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

const cameraGoal = {
  position: new THREE.Vector3().fromArray(CAMERA_PRESETS.hero_view.position),
  target: new THREE.Vector3().fromArray(CAMERA_PRESETS.hero_view.target),
  fov: CAMERA_PRESETS.hero_view.fov,
};

let currentOpenProgress = 0;

scene.add(new THREE.HemisphereLight('#fff0cc', '#160604', 1.15));

const keyLight = new THREE.DirectionalLight('#ffd18a', 2.8);
keyLight.position.set(-3.2, 5.2, 4.6);
keyLight.castShadow = true;
scene.add(keyLight);

const glow = new THREE.SpotLight('#f3b45e', 4.5, 16, 0.5, 0.75, 1.2);
glow.position.set(2.4, 4.2, 2.6);
glow.target.position.set(0, 1.8, 0);
scene.add(glow, glow.target);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4.4, 96),
  new THREE.MeshStandardMaterial({ color: '#261007', roughness: 0.92 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const surfaceHelper = new THREE.GridHelper(1.38, 8, '#f1d27a', '#6a3916');
surfaceHelper.position.set(0, 2.025, 0.03);
surfaceHelper.material.transparent = true;
surfaceHelper.material.opacity = 0.48;
scene.add(surfaceHelper);

let bookRig = new THREE.Group();
bookRig.name = 'BookRig';
scene.add(bookRig);

let animatedBook = null;
let mixer = null;
let action = null;
let duration = 1;
let decal = null;
let currentCoverNode = null;
let decalTexture = null;
let pageSpread = null;
let decalBase = {
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(),
  size: [1, 1],
};

function setStatus(message) {
  if (status) status.textContent = message;
}

function degToRad(value) {
  return THREE.MathUtils.degToRad(value);
}

function radToDeg(value) {
  return THREE.MathUtils.radToDeg(value);
}

function toFixedArray(values) {
  return values.map((value) => Number(value.toFixed(4)));
}

function drawCorner(ctx, x, y, sx, sy) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#f5cf6d';
  ctx.shadowColor = 'rgba(65, 33, 4, 0.55)';
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(0, 72);
  ctx.quadraticCurveTo(0, 16, 56, 16);
  ctx.moveTo(18, 92);
  ctx.quadraticCurveTo(24, 38, 82, 36);
  ctx.stroke();
  ctx.fillStyle = '#f5cf6d';
  ctx.beginPath();
  ctx.arc(20, 20, 7, 0, Math.PI * 2);
  ctx.arc(54, 36, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function createCoverTexture() {
  const width = 1024;
  const height = 1400;
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = width;
  canvasTexture.height = height;
  const ctx = canvasTexture.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const gold = '#f1c85f';
  const darkGold = '#8b5e17';
  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 10;
  ctx.shadowColor = 'rgba(40, 20, 2, 0.72)';
  ctx.shadowBlur = 9;
  ctx.strokeRect(92, 94, width - 184, height - 188);
  ctx.lineWidth = 3;
  ctx.strokeStyle = darkGold;
  ctx.strokeRect(122, 124, width - 244, height - 248);

  drawCorner(ctx, 92, 94, 1, 1);
  drawCorner(ctx, width - 92, 94, -1, 1);
  drawCorner(ctx, 92, height - 94, 1, -1);
  drawCorner(ctx, width - 92, height - 94, -1, -1);

  const cx = width / 2;
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#5c3b0b';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
  ctx.shadowBlur = 16;

  const crossTop = 335;
  const crossW = 64;
  const crossH = 240;
  const armW = 178;
  const armH = 58;
  const cross = new Path2D();
  cross.rect(cx - crossW / 2, crossTop, crossW, crossH);
  cross.rect(cx - armW / 2, crossTop + 76, armW, armH);
  ctx.stroke(cross);
  ctx.fill(cross);

  ctx.shadowBlur = 10;
  ctx.font = '700 86px "Cormorant Garamond", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(52, 27, 4, 0.72)';
  ctx.fillStyle = gold;
  ctx.strokeText('Munadi Hope', cx, 700);
  ctx.fillText('Munadi Hope', cx, 700);
  ctx.strokeText('Center', cx, 792);
  ctx.fillText('Center', cx, 792);

  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = '#f7d87b';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const inset = 168 + i * 18;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createLeatherTexture() {
  const size = 512;
  const leather = document.createElement('canvas');
  leather.width = size;
  leather.height = size;
  const ctx = leather.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#3a1d10');
  base.addColorStop(0.48, '#20100a');
  base.addColorStop(1, '#5a2c15');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = Math.random() > 0.52 ? `rgba(255,230,170,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, y, Math.random() * 2.2, Math.random() * 1.6);
  }

  const texture = new THREE.CanvasTexture(leather);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  return texture;
}

function normalizeToGround(object, targetHeight) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  object.scale.setScalar(targetHeight / Math.max(0.001, size.y));
  object.updateMatrixWorld(true);
  const nextBox = new THREE.Box3().setFromObject(object);
  const center = nextBox.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= nextBox.min.y;
}

function makeCoverMaterial() {
  return new THREE.MeshStandardMaterial({
    map: createLeatherTexture(),
    color: '#4a2413',
    roughness: 0.86,
    metalness: 0.03,
  });
}

function createPageTexture(side) {
  const width = 768;
  const height = 1024;
  const page = document.createElement('canvas');
  page.width = width;
  page.height = height;
  const ctx = page.getContext('2d');
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#fbefd0');
  base.addColorStop(0.55, '#ead5a8');
  base.addColorStop(1, '#d5b982');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 3000; i += 1) {
    const alpha = Math.random() * 0.055;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(92,58,25,${alpha})` : `rgba(255,255,245,${alpha})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 2.5, Math.random() * 1.7);
  }

  ctx.strokeStyle = 'rgba(108, 69, 28, 0.26)';
  ctx.lineWidth = 2;
  for (let y = 120; y < height - 110; y += 42) {
    ctx.beginPath();
    ctx.moveTo(side === 'left' ? 88 : 70, y);
    ctx.lineTo(side === 'left' ? width - 72 : width - 92, y + Math.sin(y * 0.05) * 2);
    ctx.stroke();
  }

  const spineShadow = ctx.createLinearGradient(side === 'left' ? width - 120 : 0, 0, side === 'left' ? width : 120, 0);
  spineShadow.addColorStop(0, 'rgba(75, 43, 18, 0)');
  spineShadow.addColorStop(1, 'rgba(75, 43, 18, 0.32)');
  ctx.fillStyle = spineShadow;
  ctx.fillRect(side === 'left' ? width - 150 : 0, 0, 150, height);

  const texture = new THREE.CanvasTexture(page);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createPageSpread() {
  const group = new THREE.Group();
  group.name = 'BookLabReadablePageSpread';
  group.visible = false;
  group.position.set(0, -0.41, 0.01);

  const pageShape = new THREE.Shape();
  const width = 1.84;
  const height = 2.24;
  const radius = 0.08;
  pageShape.moveTo(-width / 2 + radius, -height / 2);
  pageShape.lineTo(width / 2 - radius, -height / 2);
  pageShape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
  pageShape.lineTo(width / 2, height / 2 - radius);
  pageShape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
  pageShape.lineTo(-width / 2 + radius, height / 2);
  pageShape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
  pageShape.lineTo(-width / 2, -height / 2 + radius);
  pageShape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);

  const geometry = new THREE.ShapeGeometry(pageShape, 18);
  const leftMaterial = new THREE.MeshStandardMaterial({
    map: createPageTexture('left'),
    color: '#f2dfb6',
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rightMaterial = leftMaterial.clone();
  rightMaterial.map = createPageTexture('right');

  const leftPage = new THREE.Mesh(geometry, leftMaterial);
  leftPage.name = 'BookLabLeftReadablePage';
  leftPage.position.set(-0.93, 0, 0);
  leftPage.rotation.x = -Math.PI / 2;
  leftPage.receiveShadow = true;
  leftPage.renderOrder = 30;

  const rightPage = new THREE.Mesh(geometry.clone(), rightMaterial);
  rightPage.name = 'BookLabRightReadablePage';
  rightPage.position.set(0.93, 0, 0);
  rightPage.rotation.x = -Math.PI / 2;
  rightPage.receiveShadow = true;
  rightPage.renderOrder = 30;

  const crease = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.018, 2.16),
    new THREE.MeshStandardMaterial({ color: '#b8894f', roughness: 0.9, transparent: true, opacity: 0 }),
  );
  crease.name = 'BookLabPageCrease';
  crease.position.set(0, 0.012, 0);
  crease.material.depthTest = false;
  crease.material.depthWrite = false;
  crease.renderOrder = 31;

  group.add(leftPage, rightPage, crease);
  return group;
}

function tuneBookMaterials(book) {
  const coverMaterial = makeCoverMaterial();
  book.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const parentName = child.parent?.name || '';
    if (parentName.includes('cover')) {
      child.material = coverMaterial.clone();
    } else if (parentName.includes('paper')) {
      child.material = new THREE.MeshStandardMaterial({
        color: '#ead8aa',
        roughness: 0.9,
        map: child.material?.map || null,
      });
    }
  });
}

function findCoverNode(name) {
  if (!animatedBook) return null;
  return animatedBook.getObjectByName(name) || animatedBook.getObjectByName(name.replace(/_\d+$/, ''));
}

function getLocalBox(root) {
  root.updateWorldMatrix(true, true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const point = new THREE.Vector3();

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    const position = child.geometry.attributes.position;
    child.updateWorldMatrix(true, false);
    for (let i = 0; i < position.count; i += 1) {
      point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld).applyMatrix4(inverse);
      box.expandByPoint(point);
    }
  });

  return box;
}

function getDecalPlacement(coverNode) {
  const isRightCover = coverNode.name.includes('cover-r');
  const position = new THREE.Vector3(isRightCover ? 0.965 : -0.965, state.coverFace < 0 ? 0.05 : -2.05, 0);
  const rotation = new THREE.Euler(state.coverFace < 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0);
  const width = 1.56;
  const height = 1.5;

  console.info('[BookLab] cover local placement', {
    cover: coverNode.name,
    coverFace: state.coverFace,
    basePosition: toFixedArray(position.toArray()),
    baseRotation: toFixedArray([radToDeg(rotation.x), radToDeg(rotation.y), radToDeg(rotation.z)]),
    decalSize: toFixedArray([width, height]),
  });

  return { position, rotation, size: [width, height] };
}

function attachDecalToCover(name) {
  const coverNode = findCoverNode(name);
  if (!coverNode || !decal) return;
  currentCoverNode = coverNode;
  coverNode.attach(decal);

  decalBase = getDecalPlacement(coverNode);
  decal.geometry.dispose();
  decal.geometry = new THREE.PlaneGeometry(Math.max(0.1, decalBase.size[0]), Math.max(0.1, decalBase.size[1]));

  applyDecalTransform();
  setStatus(`Decal attached to ${coverNode.name}.`);
}

function applyBookTransform() {
  bookRig.position.fromArray(LOCKED_BOOK_TRANSFORM.position);
  bookRig.rotation.set(...LOCKED_BOOK_TRANSFORM.rotation.map(degToRad));
  bookRig.scale.setScalar(LOCKED_BOOK_TRANSFORM.scale);
}

function applyDecalTransform() {
  if (!decal) return;
  decal.position.copy(decalBase.position).add(new THREE.Vector3().fromArray(state.decal.position));
  decal.rotation.set(
    decalBase.rotation.x + degToRad(state.decal.rotation[0]),
    decalBase.rotation.y + degToRad(state.decal.rotation[1]),
    decalBase.rotation.z + degToRad(state.decal.rotation[2]),
  );
  decal.scale.set(state.decal.scale[0], state.decal.scale[1], 1);
}

function setAnimationProgress(value) {
  if (!mixer || !action) return;
  currentOpenProgress = THREE.MathUtils.clamp(Number(value), 0, 1);
  const time = currentOpenProgress * duration * OPEN_CLIP_TIME_RATIO;
  action.enabled = true;
  action.paused = false;
  action.setEffectiveWeight(1);
  mixer.setTime(time);
  mixer.update(0);
  updatePageOverlay();
}

function setCameraGoal(presetName, immediate = false) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset) return;

  cameraGoal.position.fromArray(preset.position);
  cameraGoal.target.fromArray(preset.target);
  cameraGoal.fov = preset.fov;

  if (immediate) {
    camera.position.copy(cameraGoal.position);
    controls.target.copy(cameraGoal.target);
    camera.fov = cameraGoal.fov;
    camera.updateProjectionMatrix();
    updatePageOverlay();
  }
}

function smoothstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function mixPreset(fromName, toName, t) {
  const from = CAMERA_PRESETS[fromName];
  const to = CAMERA_PRESETS[toName];
  const eased = smoothstep(t);
  cameraGoal.position.fromArray(from.position).lerp(new THREE.Vector3().fromArray(to.position), eased);
  cameraGoal.target.fromArray(from.target).lerp(new THREE.Vector3().fromArray(to.target), eased);
  cameraGoal.fov = THREE.MathUtils.lerp(from.fov, to.fov, eased);
}

function setSequenceProgress(value) {
  const progress = THREE.MathUtils.clamp(Number(value), 0, 1);
  let openProgress = 0;

  if (progress < 0.34) {
    mixPreset('hero_view', 'cover_closeup', progress / 0.34);
  } else if (progress < 0.72) {
    setCameraGoal('cover_closeup');
    openProgress = (progress - 0.34) / 0.38;
  } else {
    openProgress = 1;
    mixPreset('cover_closeup', 'open_pages_view', (progress - 0.72) / 0.28);
  }

  const animationInput = document.getElementById('animationProgress');
  if (animationInput) animationInput.value = String(openProgress);
  setAnimationProgress(openProgress);
}

function updateCamera() {
  camera.position.lerp(cameraGoal.position, 0.09);
  controls.target.lerp(cameraGoal.target, 0.09);
  camera.fov += (cameraGoal.fov - camera.fov) * 0.09;
  camera.updateProjectionMatrix();
}

function updatePageSpread(opacity = smoothstep((currentOpenProgress - 0.8) / 0.2)) {
  if (!pageSpread) return;
  pageSpread.visible = opacity > 0.01;
  pageSpread.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    child.material.opacity = opacity;
    child.material.needsUpdate = true;
  });
}

function syncInputs() {
  document.querySelectorAll('[data-bind]').forEach((input) => {
    const [group, prop, axis] = input.dataset.bind.split('.');
    if (group === 'decal') {
      if (prop === 'position') input.value = state.decal.position[{ x: 0, y: 1, z: 2 }[axis]];
      if (prop === 'rotation') input.value = state.decal.rotation[{ x: 0, y: 1, z: 2 }[axis]];
      if (prop === 'scale') input.value = state.decal.scale[{ x: 0, y: 1 }[axis]];
    }
  });
}

function setupControls() {
  document.getElementById('animationProgress').addEventListener('input', (event) => {
    setAnimationProgress(event.target.value);
  });

  document.getElementById('sequenceProgress').addEventListener('input', (event) => {
    setSequenceProgress(event.target.value);
  });

  document.querySelectorAll('[data-camera-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.dataset.cameraPreset;
      const animationInput = document.getElementById('animationProgress');
      const sequenceInput = document.getElementById('sequenceProgress');

      setCameraGoal(preset);
      if (preset === 'open_pages_view') {
        if (animationInput) animationInput.value = '1';
        setAnimationProgress(1);
      } else {
        if (animationInput) animationInput.value = '0';
        setAnimationProgress(0);
      }
      if (sequenceInput) sequenceInput.value = preset === 'open_pages_view' ? '1' : '0';
    });
  });

  document.getElementById('coverTarget').addEventListener('change', (event) => {
    state.coverTarget = event.target.value;
    attachDecalToCover(state.coverTarget);
  });

  document.getElementById('coverFace').addEventListener('change', (event) => {
    state.coverFace = Number(event.target.value);
    attachDecalToCover(state.coverTarget);
  });

  document.querySelectorAll('[data-bind]').forEach((input) => {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      const [group, prop, axis] = input.dataset.bind.split('.');
      if (group === 'decal') {
        if (prop === 'position') state.decal.position[{ x: 0, y: 1, z: 2 }[axis]] = value;
        if (prop === 'rotation') state.decal.rotation[{ x: 0, y: 1, z: 2 }[axis]] = value;
        if (prop === 'scale') state.decal.scale[{ x: 0, y: 1 }[axis]] = value;
        applyDecalTransform();
      }
    });
  });

  document.getElementById('printValues').addEventListener('click', printValues);
  syncInputs();
}

function printValues() {
  const payload = {
    coverTarget: state.coverTarget,
    coverFace: state.coverFace,
    lectern: structuredClone(LOCKED_LECTERN_TRANSFORM),
    book: {
      position: toFixedArray(LOCKED_BOOK_TRANSFORM.position),
      rotation: toFixedArray(LOCKED_BOOK_TRANSFORM.rotation),
      scale: Number(LOCKED_BOOK_TRANSFORM.scale.toFixed(4)),
    },
    decal: {
      position: toFixedArray(state.decal.position),
      rotation: toFixedArray(state.decal.rotation),
      scale: toFixedArray(state.decal.scale),
      parent: currentCoverNode?.name || null,
    },
    cameraPresets: structuredClone(CAMERA_PRESETS),
    openClipTimeRatio: OPEN_CLIP_TIME_RATIO,
    animationProgress: Number(document.getElementById('animationProgress').value),
  };
  console.info('[BookLab] final transform values', payload);
  setStatus('Printed final transform values to console.');
}

function updatePageOverlay() {
  const overlay = document.getElementById('pageOverlayTest');
  if (!overlay || !bookRig) return;

  const opacity = smoothstep((currentOpenProgress - 0.82) / 0.18);
  updatePageSpread(opacity);
  overlay.style.setProperty('--page-overlay-opacity', opacity.toFixed(3));

  if (opacity <= 0.001) return;

  bookRig.updateWorldMatrix(true, true);
  const points = PAGE_ANCHORS.map((point) => bookRig.localToWorld(point.clone()).project(camera));
  const visible = points.every((point) => point.z > -1 && point.z < 1);
  if (!visible) {
    overlay.style.setProperty('--page-overlay-opacity', '0');
    return;
  }

  const xs = points.map((point) => (point.x * 0.5 + 0.5) * window.innerWidth);
  const ys = points.map((point) => (-point.y * 0.5 + 0.5) * window.innerHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = THREE.MathUtils.clamp(maxX - minX, 260, Math.min(680, window.innerWidth - 32));
  const height = THREE.MathUtils.clamp(maxY - minY, 118, Math.min(260, window.innerHeight * 0.34));

  overlay.style.left = `${(minX + maxX) / 2}px`;
  overlay.style.top = `${(minY + maxY) / 2}px`;
  overlay.style.width = `${width}px`;
  overlay.style.minHeight = `${height}px`;
  overlay.style.setProperty('--page-tilt', '-7deg');
}

async function init() {
  setupControls();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const [lecternGltf, bookGltf] = await Promise.all([
    loader.loadAsync(ASSETS.lectern),
    loader.loadAsync(ASSETS.book),
  ]);

  const lectern = lecternGltf.scene;
  normalizeToGround(lectern, LOCKED_LECTERN_TRANSFORM.targetHeight);
  lectern.position.fromArray(LOCKED_LECTERN_TRANSFORM.position);
  lectern.rotation.set(...LOCKED_LECTERN_TRANSFORM.rotation.map(degToRad));
  lectern.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  scene.add(lectern);

  animatedBook = bookGltf.scene;
  tuneBookMaterials(animatedBook);
  bookRig.add(animatedBook);
  pageSpread = createPageSpread();
  bookRig.add(pageSpread);
  applyBookTransform();

  mixer = new THREE.AnimationMixer(animatedBook);
  const clip = bookGltf.animations[0];
  if (clip) {
    duration = clip.duration;
    action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    setAnimationProgress(0);
  }

  decalTexture = createCoverTexture();
  decal = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: decalTexture,
      transparent: true,
      opacity: 0.98,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  decal.name = 'MunadiCoverDecal';
  decal.renderOrder = 20;
  attachDecalToCover(state.coverTarget);

  setStatus('Book lab ready. Book and lectern transforms are locked; use presets, opening slider, and sequence test.');
  console.info('[BookLab] animated book nodes', {
    coverCandidates: ['cover-r_35', 'cover-l_36'],
    animation: clip ? { name: clip.name, duration: clip.duration } : null,
  });
}

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function render() {
  updateCamera();
  controls.update();
  updatePageOverlay();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener('resize', resize, { passive: true });
resize();
init().catch((error) => {
  console.error(error);
  setStatus(`Book lab failed to load: ${error.message}`);
});
render();
