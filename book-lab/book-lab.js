import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ASSETS = {
  book: '/public/assets/models/book_animated_book__historical_book.glb',
  lectern: '/public/assets/models/optimized/lectern.glb',
};

const DEFAULTS = {
  coverTarget: 'cover-l_36',
  coverFace: -1,
  book: {
    position: [0, 2.03, 0.03],
    rotation: [0, 0, 180],
    scale: 0.32,
  },
  decal: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1.02, 1.02],
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
camera.position.set(2.35, 4.55, 3.45);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.02, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

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
  bookRig.position.fromArray(state.book.position);
  bookRig.rotation.set(...state.book.rotation.map(degToRad));
  bookRig.scale.setScalar(state.book.scale);
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
  const time = Number(value) * duration;
  action.enabled = true;
  action.paused = false;
  action.setEffectiveWeight(1);
  mixer.setTime(time);
  mixer.update(0);
}

function syncInputs() {
  document.querySelectorAll('[data-bind]').forEach((input) => {
    const [group, prop, axis] = input.dataset.bind.split('.');
    if (group === 'book') {
      if (prop === 'position') input.value = state.book.position[{ x: 0, y: 1, z: 2 }[axis]];
      if (prop === 'rotation') input.value = state.book.rotation[{ x: 0, y: 1, z: 2 }[axis]];
      if (prop === 'scale') input.value = state.book.scale;
    }
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
      if (group === 'book') {
        if (prop === 'position') state.book.position[{ x: 0, y: 1, z: 2 }[axis]] = value;
        if (prop === 'rotation') state.book.rotation[{ x: 0, y: 1, z: 2 }[axis]] = value;
        if (prop === 'scale') state.book.scale = value;
        applyBookTransform();
      }
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
    book: {
      position: toFixedArray(state.book.position),
      rotation: toFixedArray(state.book.rotation),
      scale: Number(state.book.scale.toFixed(4)),
    },
    decal: {
      position: toFixedArray(state.decal.position),
      rotation: toFixedArray(state.decal.rotation),
      scale: toFixedArray(state.decal.scale),
      parent: currentCoverNode?.name || null,
    },
    animationProgress: Number(document.getElementById('animationProgress').value),
  };
  console.info('[BookLab] final transform values', payload);
  setStatus('Printed final transform values to console.');
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
  normalizeToGround(lectern, 2.05);
  lectern.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  scene.add(lectern);

  animatedBook = bookGltf.scene;
  tuneBookMaterials(animatedBook);
  bookRig.add(animatedBook);
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

  setStatus('Book lab ready. Adjust controls, then print final values.');
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
  controls.update();
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
