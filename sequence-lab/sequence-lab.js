import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const ASSETS = {
  book: '/public/assets/models/book_animated_book__historical_book.glb',
  lectern: '/public/assets/models/optimized/lectern.glb',
  church: '/public/assets/models/optimized/st_bartholomew-the-less_interior.glb',
};

const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === '1';

const BOOK_LAB_STORAGE_KEY = 'munadiHopeCenter.bookLab.transforms';
const BOOK_LAB_SEQUENCE_STORAGE_KEY = 'munadiHopeCenter.sequenceLab.sequence';

const LOCKED_LECTERN_TRANSFORM = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  targetHeight: 2.05,
};

const BOOK_LAB_FINAL_TRANSFORMS = {
  cover: {
    target: 'cover-l_36',
    face: 1,
  },
  book: {
    position: [-0.33, 2.02, -0.12],
    rotation: [18, 0, 360],
    scale: 0.26,
  },
  decal: {
    position: [0, 0, 0],
    rotation: [0, 0, 180],
    scale: [1.36, 1.35],
  },
};

const OPEN_CLIP_TIME_RATIO = 0.5;

const PRESET_LABELS = {
  entrance: 'Entrance View',
  aisle: 'Aisle Walk',
  stage: 'Stage Approach',
  altar: 'Altar / Lectern End Point',
  bible: 'Bible Closeup Preview',
};

const HUMAN_AXIS_LABELS = {
  position: {
    x: 'Move Left / Right',
    y: 'Move Up / Down',
    z: 'Move Forward / Back',
  },
  target: {
    x: 'Look At Left / Right',
    y: 'Look Higher / Lower',
    z: 'Look Closer / Further',
  },
  rotation: {
    x: 'Tilt Up / Down',
    y: 'Turn Left / Right',
    z: 'Lean Sideways',
  },
};

const BOOK_LAB_DEFAULT_SEQUENCE = {
  progress: 0,
  camera: {
    presets: {
      entrance: {
        position: [0, 2.1, 9.2],
        target: [0, 2.0, 4.2],
        fov: 48,
        distance: 1,
      },
      aisle: {
        position: [0, 2.0, 4.9],
        target: [0, 2.05, 0.7],
        fov: 42,
        distance: 1,
      },
      stage: {
        position: [0, 2.18, 1.25],
        target: [0, 2.12, -2.1],
        fov: 34,
        distance: 1,
      },
      altar: {
        position: [0, 2.3, -1.45],
        target: [0, 2.08, -3.45],
        fov: 28,
        distance: 1,
      },
      bible: {
        position: [-0.1, 3.08, -3.04],
        target: [0, 2.26, -3.55],
        fov: 22,
        distance: 1,
      },
    },
  },
  altar: {
    position: [0, 0, -3.55],
    rotation: [0, 180, 0],
    scale: 1,
  },
  church: {
    position: [0, -0.2, 0],
    rotation: [0, 0, 0],
    scale: 0.82,
    visible: true,
  },
  environment: {
    fog: 0.055,
    darkness: 0.78,
  },
  overlays: {
    opacity: 0.86,
    borderVisible: true,
    left: {
      position: [-0.92, -0.46, -0.08],
      rotation: [0, 0, 0],
      scale: [1.18, 0.84],
    },
    right: {
      position: [0.55, -0.46, -0.03],
      rotation: [0, 0, 0],
      scale: [1.2, 0.84],
    },
  },
};

function cloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTransforms(value = {}) {
  const source = value || {};
  const cover = source.cover || {};
  const book = source.book || {};
  const decal = source.decal || {};
  const final = cloneConfig(BOOK_LAB_FINAL_TRANSFORMS);

  return {
    coverTarget: cover.target ?? source.coverTarget ?? final.cover.target,
    coverFace: Number(cover.face ?? source.coverFace ?? final.cover.face),
    book: {
      position: [...(book.position || final.book.position)],
      rotation: [...(book.rotation || final.book.rotation)],
      scale: Number(book.scale ?? final.book.scale),
    },
    decal: {
      position: [...(decal.position || final.decal.position)],
      rotation: [...(decal.rotation || final.decal.rotation)],
      scale: [...(decal.scale || final.decal.scale)],
    },
  };
}

function getCurrentTransforms() {
  return {
    cover: {
      target: state.coverTarget,
      face: state.coverFace,
    },
    book: {
      position: toFixedArray(state.book.position),
      rotation: toFixedArray(state.book.rotation),
      scale: Number(state.book.scale.toFixed(4)),
    },
    decal: {
      position: toFixedArray(state.decal.position),
      rotation: toFixedArray(state.decal.rotation),
      scale: toFixedArray(state.decal.scale),
    },
  };
}

function loadStoredTransforms() {
  try {
    const saved = window.localStorage.getItem(BOOK_LAB_STORAGE_KEY);
    return normalizeTransforms(saved ? JSON.parse(saved) : DEFAULTS);
  } catch (error) {
    console.warn('[SequenceLab] Could not load saved calibration; using final approved values.', error);
    return cloneConfig(DEFAULTS);
  }
}

function persistTransforms() {
  try {
    window.localStorage.setItem(BOOK_LAB_STORAGE_KEY, JSON.stringify(getCurrentTransforms()));
  } catch (error) {
    console.warn('[SequenceLab] Could not save calibration.', error);
  }
}

function setStateFromTransforms(transforms) {
  const next = normalizeTransforms(transforms);
  state.coverTarget = next.coverTarget;
  state.coverFace = next.coverFace;
  state.book = next.book;
  state.decal = next.decal;
}

function normalizeSequenceConfig(value = {}) {
  const source = value || {};
  const defaults = cloneConfig(BOOK_LAB_DEFAULT_SEQUENCE);
  const camera = source.camera || {};
  const presetSource = camera.presets || {};
  const overlays = source.overlays || {};
  const left = overlays.left || {};
  const right = overlays.right || {};
  const normalizePreset = (key, legacyKey = key) => {
    const preset = presetSource[key] || camera[legacyKey] || {};
    const fallback = defaults.camera.presets[key];
    return {
      position: [...(preset.position || fallback.position)],
      target: [...(preset.target || fallback.target)],
      fov: Number(preset.fov ?? camera.fov ?? fallback.fov),
      distance: Number(preset.distance ?? camera.distance ?? fallback.distance),
    };
  };

  return {
    progress: Number(source.progress ?? defaults.progress),
    camera: {
      presets: {
        entrance: normalizePreset('entrance', 'hero'),
        aisle: normalizePreset('aisle', 'hero'),
        stage: normalizePreset('stage', 'cover'),
        altar: normalizePreset('altar', 'cover'),
        bible: normalizePreset('bible', 'pages'),
      },
    },
    altar: {
      position: [...(source.altar?.position || defaults.altar.position)],
      rotation: [...(source.altar?.rotation || defaults.altar.rotation)],
      scale: Number(source.altar?.scale ?? defaults.altar.scale),
    },
    church: {
      position: [...(source.church?.position || defaults.church.position)],
      rotation: [...(source.church?.rotation || defaults.church.rotation)],
      scale: Number(source.church?.scale ?? defaults.church.scale),
      visible: Boolean(source.church?.visible ?? defaults.church.visible),
    },
    environment: {
      fog: Number(source.environment?.fog ?? defaults.environment.fog),
      darkness: Number(source.environment?.darkness ?? defaults.environment.darkness),
    },
    overlays: {
      opacity: Number(overlays.opacity ?? defaults.overlays.opacity),
      borderVisible: Boolean(overlays.borderVisible ?? defaults.overlays.borderVisible),
      left: {
        position: [...(left.position || defaults.overlays.left.position)],
        rotation: [...(left.rotation || defaults.overlays.left.rotation)],
        scale: [...(left.scale || defaults.overlays.left.scale)],
      },
      right: {
        position: [...(right.position || defaults.overlays.right.position)],
        rotation: [...(right.rotation || defaults.overlays.right.rotation)],
        scale: [...(right.scale || defaults.overlays.right.scale)],
      },
    },
  };
}

function loadStoredSequenceConfig() {
  try {
    const saved = window.localStorage.getItem(BOOK_LAB_SEQUENCE_STORAGE_KEY);
    return normalizeSequenceConfig(saved ? JSON.parse(saved) : BOOK_LAB_DEFAULT_SEQUENCE);
  } catch (error) {
    console.warn('[SequenceLab] Could not load saved sequence; using defaults.', error);
    return normalizeSequenceConfig(BOOK_LAB_DEFAULT_SEQUENCE);
  }
}

function getSequenceConfigForExport() {
  return {
    progress: Number(sequenceState.progress.toFixed(4)),
    camera: {
      presets: Object.fromEntries(Object.keys(PRESET_LABELS).map((key) => ([
        key,
        {
          position: toFixedArray(sequenceState.camera.presets[key].position),
          target: toFixedArray(sequenceState.camera.presets[key].target),
          fov: Number(sequenceState.camera.presets[key].fov.toFixed(4)),
          distance: Number(sequenceState.camera.presets[key].distance.toFixed(4)),
        },
      ]))),
    },
    altar: {
      position: toFixedArray(sequenceState.altar.position),
      rotation: toFixedArray(sequenceState.altar.rotation),
      scale: Number(sequenceState.altar.scale.toFixed(4)),
    },
    church: {
      position: toFixedArray(sequenceState.church.position),
      rotation: toFixedArray(sequenceState.church.rotation),
      scale: Number(sequenceState.church.scale.toFixed(4)),
      visible: sequenceState.church.visible,
    },
    environment: {
      fog: Number(sequenceState.environment.fog.toFixed(4)),
      darkness: Number(sequenceState.environment.darkness.toFixed(4)),
    },
    overlays: {
      opacity: Number(sequenceState.overlays.opacity.toFixed(4)),
      borderVisible: sequenceState.overlays.borderVisible,
      left: {
        position: toFixedArray(sequenceState.overlays.left.position),
        rotation: toFixedArray(sequenceState.overlays.left.rotation),
        scale: toFixedArray(sequenceState.overlays.left.scale),
      },
      right: {
        position: toFixedArray(sequenceState.overlays.right.position),
        rotation: toFixedArray(sequenceState.overlays.right.rotation),
        scale: toFixedArray(sequenceState.overlays.right.scale),
      },
    },
  };
}

function persistSequenceConfig() {
  window.localStorage.setItem(BOOK_LAB_SEQUENCE_STORAGE_KEY, JSON.stringify(getSequenceConfigForExport()));
}

const DEFAULTS = normalizeTransforms(BOOK_LAB_FINAL_TRANSFORMS);
const state = loadStoredTransforms();
const sequenceState = loadStoredSequenceConfig();
const status = document.getElementById('status');
const canvas = document.getElementById('sequenceLabCanvas');
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

const initialCameraFrame = getCameraFrame('entrance');
const camera = new THREE.PerspectiveCamera(initialCameraFrame.fov, 1, 0.1, 80);
camera.position.copy(initialCameraFrame.position);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(initialCameraFrame.target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

const cameraGoal = {
  position: initialCameraFrame.position.clone(),
  target: initialCameraFrame.target.clone(),
  fov: initialCameraFrame.fov,
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

const surfaceHelper = new THREE.GridHelper(1.38, 8, '#f1d27a', '#6a3916');
surfaceHelper.name = 'DebugLecternSurfaceHelper';
surfaceHelper.position.set(0, 2.025, 0.03);
surfaceHelper.material.transparent = true;
surfaceHelper.material.opacity = 0.48;
surfaceHelper.visible = DEBUG_MODE;

let churchRoot = null;

const altarRig = new THREE.Group();
altarRig.name = 'ApprovedLecternBibleAltarRig';
scene.add(altarRig);
altarRig.add(surfaceHelper);

let bookRig = new THREE.Group();
bookRig.name = 'BookRig';
altarRig.add(bookRig);

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

  console.info('[SequenceLab] cover local placement', {
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
  currentOpenProgress = THREE.MathUtils.clamp(Number(value), 0, 1);
  const time = currentOpenProgress * duration * OPEN_CLIP_TIME_RATIO;
  action.enabled = true;
  action.paused = false;
  action.setEffectiveWeight(1);
  mixer.setTime(time);
  mixer.update(0);
  updatePageOverlay();
}

function getCameraKey(presetName) {
  if (presetName === 'entrance') return 'entrance';
  if (presetName === 'aisle') return 'aisle';
  if (presetName === 'stage') return 'stage';
  if (presetName === 'altar') return 'altar';
  if (presetName === 'bible') return 'bible';
  if (presetName === 'hero_view' || presetName === 'hero') return 'entrance';
  if (presetName === 'cover_closeup' || presetName === 'cover') return 'stage';
  if (presetName === 'open_pages_view' || presetName === 'open_pages_fullscreen' || presetName === 'pages') return 'bible';
  return 'entrance';
}

function getCameraFrame(presetName) {
  const key = getCameraKey(presetName);
  const raw = sequenceState.camera.presets[key];
  const target = new THREE.Vector3().fromArray(raw.target);
  const basePosition = new THREE.Vector3().fromArray(raw.position);
  const position = target.clone().add(basePosition.sub(target).multiplyScalar(raw.distance));
  return {
    position,
    target,
    fov: raw.fov,
  };
}

function setCameraGoal(presetName, immediate = false) {
  const preset = getCameraFrame(presetName);

  cameraGoal.position.copy(preset.position);
  cameraGoal.target.copy(preset.target);
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
  const from = getCameraFrame(fromName);
  const to = getCameraFrame(toName);
  const eased = smoothstep(t);
  cameraGoal.position.copy(from.position).lerp(to.position, eased);
  cameraGoal.target.copy(from.target).lerp(to.target, eased);
  cameraGoal.fov = THREE.MathUtils.lerp(from.fov, to.fov, eased);
}

function setSequenceProgress(value) {
  const progress = THREE.MathUtils.clamp(Number(value), 0, 1);
  sequenceState.progress = progress;
  let openProgress = 0;

  if (progress < 0.25) {
    mixPreset('entrance', 'aisle', progress / 0.25);
  } else if (progress < 0.55) {
    mixPreset('aisle', 'stage', (progress - 0.25) / 0.3);
  } else if (progress < 0.82) {
    mixPreset('stage', 'altar', (progress - 0.55) / 0.27);
  } else {
    setCameraGoal('altar');
  }

  const animationInput = document.getElementById('animationProgress');
  if (animationInput) animationInput.value = String(openProgress);
  setAnimationProgress(openProgress);
  syncSequenceInputs();
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
    child.material.opacity = child.name === 'BookLabPageCrease' ? opacity * 0.36 : opacity * 0.78;
    child.material.needsUpdate = true;
  });
}

function syncInputs() {
  document.getElementById('coverTarget').value = state.coverTarget;
  document.getElementById('coverFace').value = String(state.coverFace);

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

function getAxisIndex(axis) {
  return { x: 0, y: 1, z: 2 }[axis];
}

function getSequenceValue(path) {
  const parts = path.split('.');
  if (parts[0] === 'progress') return sequenceState.progress;

  if (parts[0] === 'camera') {
    const presetKey = parts[1];
    if (parts[2] === 'fov' || parts[2] === 'distance') return sequenceState.camera.presets[presetKey][parts[2]];
    const cameraKey = parts[1];
    const prop = parts[2];
    const axis = parts[3];
    return sequenceState.camera.presets[cameraKey][prop][getAxisIndex(axis)];
  }

  if (parts[0] === 'altar') {
    if (parts[1] === 'scale') return sequenceState.altar.scale;
    return sequenceState.altar[parts[1]][getAxisIndex(parts[2])];
  }

  if (parts[0] === 'church') {
    if (parts[1] === 'visible') return sequenceState.church.visible;
    if (parts[1] === 'scale') return sequenceState.church.scale;
    return sequenceState.church[parts[1]][getAxisIndex(parts[2])];
  }

  if (parts[0] === 'environment') {
    return sequenceState.environment[parts[1]];
  }

  if (parts[0] === 'overlays') {
    if (parts.length === 2) return sequenceState.overlays[parts[1]];
    const side = parts[1];
    const prop = parts[2];
    const axis = parts[3];
    const axisIndex = prop === 'scale' ? { x: 0, y: 1 }[axis] : getAxisIndex(axis);
    return sequenceState.overlays[side][prop][axisIndex];
  }

  return '';
}

function setSequenceValue(path, rawValue, isChecked = false) {
  const parts = path.split('.');
  if (parts[0] === 'progress') {
    setSequenceProgress(rawValue);
    return;
  }

  if (parts[0] === 'camera') {
    const cameraKey = parts[1];
    if (parts[2] === 'fov' || parts[2] === 'distance') {
      sequenceState.camera.presets[cameraKey][parts[2]] = Number(rawValue);
    } else {
      const prop = parts[2];
      const axis = parts[3];
      sequenceState.camera.presets[cameraKey][prop][getAxisIndex(axis)] = Number(rawValue);
    }
    setSequenceProgress(sequenceState.progress);
    return;
  }

  if (parts[0] === 'altar') {
    if (parts[1] === 'scale') {
      sequenceState.altar.scale = Number(rawValue);
    } else {
      sequenceState.altar[parts[1]][getAxisIndex(parts[2])] = Number(rawValue);
    }
    applyAltarTransform();
    setSequenceProgress(sequenceState.progress);
    updatePageOverlay();
    return;
  }

  if (parts[0] === 'church') {
    if (parts[1] === 'visible') {
      sequenceState.church.visible = isChecked;
    } else if (parts[1] === 'scale') {
      sequenceState.church.scale = Number(rawValue);
    } else {
      sequenceState.church[parts[1]][getAxisIndex(parts[2])] = Number(rawValue);
    }
    applyChurchTransform();
    return;
  }

  if (parts[0] === 'environment') {
    sequenceState.environment[parts[1]] = Number(rawValue);
    applyEnvironment();
    return;
  }

  if (parts[0] === 'overlays') {
    if (parts[1] === 'borderVisible') {
      sequenceState.overlays.borderVisible = isChecked;
    } else if (parts[1] === 'opacity') {
      sequenceState.overlays.opacity = Number(rawValue);
    } else {
      const side = parts[1];
      const prop = parts[2];
      const axis = parts[3];
      const axisIndex = prop === 'scale' ? { x: 0, y: 1 }[axis] : getAxisIndex(axis);
      sequenceState.overlays[side][prop][axisIndex] = Number(rawValue);
    }
    updatePageOverlay();
  }
}

function syncSequenceInputs() {
  document.querySelectorAll('[data-seq]').forEach((input) => {
    const value = getSequenceValue(input.dataset.seq);
    if (input.type === 'checkbox') {
      input.checked = Boolean(value);
    } else {
      input.value = value;
    }
  });
}

function makeControlLabel(label, path, step = '0.05', type = 'number', attrs = '') {
  return `<label>${label} <input data-seq="${path}" type="${type}" step="${step}" ${attrs} /></label>`;
}

function createJourneyPresetControls() {
  const mount = document.getElementById('journeyPresetControls');
  if (!mount) return;

  mount.innerHTML = Object.entries(PRESET_LABELS).map(([key, label]) => `
    <div class="control-section preset-control-group">
      <p class="section-title">${label}</p>
      <p class="section-help">Camera position is where the visitor stands. Camera target is where the visitor looks.</p>
      ${makeControlLabel(HUMAN_AXIS_LABELS.position.x, `camera.${key}.position.x`)}
      ${makeControlLabel(HUMAN_AXIS_LABELS.position.y, `camera.${key}.position.y`)}
      ${makeControlLabel(HUMAN_AXIS_LABELS.position.z, `camera.${key}.position.z`)}
      ${makeControlLabel(HUMAN_AXIS_LABELS.target.x, `camera.${key}.target.x`)}
      ${makeControlLabel(HUMAN_AXIS_LABELS.target.y, `camera.${key}.target.y`)}
      ${makeControlLabel(HUMAN_AXIS_LABELS.target.z, `camera.${key}.target.z`)}
      ${makeControlLabel('Zoom In / Out', `camera.${key}.fov`, '1', 'number', 'min="12" max="70"')}
      ${makeControlLabel('Camera Distance', `camera.${key}.distance`, '0.01', 'number', 'min="0.3" max="2.5"')}
    </div>
  `).join('');
}

function applyAltarTransform() {
  altarRig.position.fromArray(sequenceState.altar.position);
  altarRig.rotation.set(...sequenceState.altar.rotation.map(degToRad));
  altarRig.scale.setScalar(sequenceState.altar.scale);
}

function applyChurchTransform() {
  if (!churchRoot) return;
  churchRoot.position.fromArray(sequenceState.church.position);
  churchRoot.rotation.set(...sequenceState.church.rotation.map(degToRad));
  churchRoot.scale.setScalar(sequenceState.church.scale);
  churchRoot.visible = sequenceState.church.visible;
}

function applyEnvironment() {
  scene.background = new THREE.Color().setRGB(
    0.08 * (1 - sequenceState.environment.darkness),
    0.045 * (1 - sequenceState.environment.darkness),
    0.025 * (1 - sequenceState.environment.darkness),
  );
  scene.fog = new THREE.FogExp2('#090403', sequenceState.environment.fog);
  if (churchRoot) {
    const tone = THREE.MathUtils.lerp(1, 0.38, sequenceState.environment.darkness);
    churchRoot.traverse((child) => {
      if (!child.isMesh || !child.material?.color) return;
      child.material.color.setScalar(tone);
      child.material.needsUpdate = true;
    });
  }
}

function setupControls() {
  createJourneyPresetControls();

  document.getElementById('animationProgress').addEventListener('input', (event) => {
    setAnimationProgress(event.target.value);
  });

  document.querySelectorAll('[data-camera-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.dataset.cameraPreset;
      const animationInput = document.getElementById('animationProgress');
      const sequenceInput = document.getElementById('sequenceProgress');

      setCameraGoal(preset);
      if (getCameraKey(preset) === 'bible') {
        if (animationInput) animationInput.value = '1';
        setAnimationProgress(1);
      } else {
        if (animationInput) animationInput.value = '0';
        setAnimationProgress(0);
      }
      if (sequenceInput) {
        sequenceState.progress = { entrance: 0, aisle: 0.25, stage: 0.55, altar: 1, bible: 1 }[getCameraKey(preset)] ?? 0;
        sequenceInput.value = String(sequenceState.progress);
      }
      syncSequenceInputs();
    });
  });

  document.getElementById('coverTarget').addEventListener('change', (event) => {
    state.coverTarget = event.target.value;
    attachDecalToCover(state.coverTarget);
    persistTransforms();
  });

  document.getElementById('coverFace').addEventListener('change', (event) => {
    state.coverFace = Number(event.target.value);
    attachDecalToCover(state.coverTarget);
    persistTransforms();
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
        updatePageOverlay();
        persistTransforms();
      }
      if (group === 'decal') {
        if (prop === 'position') state.decal.position[{ x: 0, y: 1, z: 2 }[axis]] = value;
        if (prop === 'rotation') state.decal.rotation[{ x: 0, y: 1, z: 2 }[axis]] = value;
        if (prop === 'scale') state.decal.scale[{ x: 0, y: 1 }[axis]] = value;
        applyDecalTransform();
        persistTransforms();
      }
    });
  });

  document.getElementById('printValues').addEventListener('click', printValues);
  document.getElementById('resetDefaults').addEventListener('click', resetToFinalApprovedValues);
  document.getElementById('printSequence').addEventListener('click', printSequenceConfig);
  document.getElementById('saveSequence').addEventListener('click', saveCurrentSequence);
  document.getElementById('resetSequence').addEventListener('click', resetSequenceConfig);

  document.querySelectorAll('[data-seq]').forEach((input) => {
    input.addEventListener('input', () => {
      setSequenceValue(input.dataset.seq, input.value, input.checked);
    });
  });

  syncInputs();
  syncSequenceInputs();
}

function printValues() {
  const payload = {
    BOOK_LAB_FINAL_TRANSFORMS: getCurrentTransforms(),
    lectern: structuredClone(LOCKED_LECTERN_TRANSFORM),
    decalParent: currentCoverNode?.name || null,
    openClipTimeRatio: OPEN_CLIP_TIME_RATIO,
    animationProgress: Number(document.getElementById('animationProgress').value),
  };
  console.info('[SequenceLab] final transform values', payload);
  setStatus('Printed final transform values to console.');
}

function resetToFinalApprovedValues() {
  setStateFromTransforms(BOOK_LAB_FINAL_TRANSFORMS);
  persistTransforms();
  applyBookTransform();
  syncInputs();
  attachDecalToCover(state.coverTarget);
  applyDecalTransform();
  updatePageOverlay();
  setStatus('Reset to approved book and lectern placement.');
}

function printSequenceConfig() {
  const configText = `const SEQUENCE_LAB_DEFAULT_SEQUENCE = ${JSON.stringify(getSequenceConfigForExport(), null, 2)};`;
  console.info('[SequenceLab] final sequence config\n%s', configText);
  setStatus('Printed final sequence config to console.');
}

function saveCurrentSequence() {
  persistSequenceConfig();
  printSequenceConfig();
  setStatus('Saved current camera/page overlay sequence to localStorage.');
}

function resetSequenceConfig() {
  const next = normalizeSequenceConfig(BOOK_LAB_DEFAULT_SEQUENCE);
  sequenceState.progress = next.progress;
  sequenceState.camera = next.camera;
  sequenceState.altar = next.altar;
  sequenceState.church = next.church;
  sequenceState.environment = next.environment;
  sequenceState.overlays = next.overlays;
  window.localStorage.removeItem(BOOK_LAB_SEQUENCE_STORAGE_KEY);
  applyAltarTransform();
  applyChurchTransform();
  applyEnvironment();
  syncSequenceInputs();
  setSequenceProgress(sequenceState.progress);
  updatePageOverlay();
  setStatus('Reset church sequence to defaults.');
}

function updatePageOverlay() {
  const overlay = document.getElementById('pageOverlayTest');
  if (!overlay || !bookRig) return;

  const reveal = smoothstep((currentOpenProgress - 0.82) / 0.18);
  const opacity = reveal * sequenceState.overlays.opacity;
  updatePageSpread(reveal);
  positionPageSafeArea('leftPageSafeArea', sequenceState.overlays.left, opacity);
  positionPageSafeArea('rightPageSafeArea', sequenceState.overlays.right, opacity);
}

function positionPageSafeArea(id, config, opacity) {
  const element = document.getElementById(id);
  if (!element) return;

  element.style.setProperty('--page-overlay-opacity', opacity.toFixed(3));
  element.style.setProperty('--safe-border-opacity', sequenceState.overlays.borderVisible ? '0.2' : '0');

  if (opacity <= 0.001) return;

  const areaObject = new THREE.Object3D();
  areaObject.position.fromArray(config.position);
  areaObject.rotation.set(...config.rotation.map(degToRad));
  areaObject.updateMatrix();

  const width = Math.max(0.05, config.scale[0]);
  const height = Math.max(0.05, config.scale[1]);
  const corners = [
    new THREE.Vector3(-width / 2, 0, -height / 2),
    new THREE.Vector3(width / 2, 0, -height / 2),
    new THREE.Vector3(-width / 2, 0, height / 2),
    new THREE.Vector3(width / 2, 0, height / 2),
  ].map((corner) => {
    const world = bookRig.localToWorld(corner.applyMatrix4(areaObject.matrix));
    return world.project(camera);
  });

  const visible = corners.every((point) => point.z > -1 && point.z < 1);
  if (!visible) {
    element.style.setProperty('--page-overlay-opacity', '0');
    return;
  }

  const screen = corners.map((point) => ({
    x: (point.x * 0.5 + 0.5) * window.innerWidth,
    y: (-point.y * 0.5 + 0.5) * window.innerHeight,
  }));
  const centerX = screen.reduce((sum, point) => sum + point.x, 0) / screen.length;
  const centerY = screen.reduce((sum, point) => sum + point.y, 0) / screen.length;
  const screenWidth = Math.hypot(screen[1].x - screen[0].x, screen[1].y - screen[0].y);
  const screenHeight = Math.hypot(screen[2].x - screen[0].x, screen[2].y - screen[0].y);
  const rotation = Math.atan2(screen[1].y - screen[0].y, screen[1].x - screen[0].x);

  element.style.setProperty('--safe-left', `${centerX}px`);
  element.style.setProperty('--safe-top', `${centerY}px`);
  element.style.setProperty('--safe-width', `${THREE.MathUtils.clamp(screenWidth, 120, window.innerWidth * 0.72)}px`);
  element.style.setProperty('--safe-height', `${THREE.MathUtils.clamp(screenHeight, 80, window.innerHeight * 0.52)}px`);
  element.style.setProperty('--safe-rotation', `${rotation}rad`);
  element.style.setProperty('--safe-scale', '1');
}

async function init() {
  setupControls();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const [churchGltf, lecternGltf, bookGltf] = await Promise.all([
    loader.loadAsync(ASSETS.church),
    loader.loadAsync(ASSETS.lectern),
    loader.loadAsync(ASSETS.book),
  ]);

  churchRoot = churchGltf.scene;
  churchRoot.name = 'ChurchInteriorScan';
  churchRoot.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = true;
    if (child.material) {
      child.material = child.material.clone();
      child.material.toneMapped = true;
    }
  });
  scene.add(churchRoot);
  applyChurchTransform();
  applyEnvironment();

  const lectern = lecternGltf.scene;
  normalizeToGround(lectern, LOCKED_LECTERN_TRANSFORM.targetHeight);
  lectern.position.fromArray(LOCKED_LECTERN_TRANSFORM.position);
  lectern.rotation.set(...LOCKED_LECTERN_TRANSFORM.rotation.map(degToRad));
  lectern.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  altarRig.add(lectern);
  applyAltarTransform();

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
  setSequenceProgress(sequenceState.progress);

  setStatus('Sequence lab ready. Approved book and lectern are locked; tune the church journey controls.');
  console.info('[SequenceLab] animated book nodes', {
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
  setStatus(`Sequence lab failed to load: ${error.message}`);
});
render();
