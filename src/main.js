import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { APPROVED_SEQUENCE_CONFIG } from './approved-sequence-config.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPowerViewport = window.matchMedia('(max-width: 720px)').matches;

const ASSETS = {
  book: '/public/assets/models/book_animated_book__historical_book.glb',
  lectern: '/public/assets/models/optimized/lectern.glb',
  church: '/public/assets/models/optimized/st_bartholomew-the-less_interior.glb',
};

const LECTERN_TRANSFORM = APPROVED_SEQUENCE_CONFIG.lectern;

const APPROVED_BOOK_TRANSFORMS = APPROVED_SEQUENCE_CONFIG.book;
const OPENING_CONFIG = APPROVED_SEQUENCE_CONFIG.opening;
const LIGHTING_CONFIG = APPROVED_SEQUENCE_CONFIG.lighting;
const MATERIAL_CONFIG = APPROVED_SEQUENCE_CONFIG.materials;
const timeline = [
  { at: 0, key: 'gate_entry' },
  { at: 0.16, key: 'aisle_reveal' },
  { at: 0.38, key: 'aisle_walk_mid' },
  { at: 0.58, key: 'altar_approach' },
  { at: 0.72, key: 'lectern_end_point' },
  { at: 0.86, key: 'bible_closeup' },
  { at: 1, key: 'bible_open_pages' },
];

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function degToRad(value) {
  return THREE.MathUtils.degToRad(value);
}

function toVec3(values) {
  return new THREE.Vector3().fromArray(values);
}

function getCameraFrame(key) {
  const preset = APPROVED_SEQUENCE_CONFIG.camera.presets[key];
  const target = toVec3(preset.target);
  const basePosition = toVec3(preset.position);
  const position = target.clone().add(basePosition.sub(target).multiplyScalar(preset.distance));
  return { position, target, fov: preset.fov };
}

function getTimelineFrame(progress) {
  const p = reducedMotion ? 1 : clamp(progress);
  let start = timeline[0];
  let end = timeline[timeline.length - 1];

  for (let i = 0; i < timeline.length - 1; i += 1) {
    if (p >= timeline[i].at && p <= timeline[i + 1].at) {
      start = timeline[i];
      end = timeline[i + 1];
      break;
    }
  }

  const local = smoothstep(start.at, end.at, p);
  const a = getCameraFrame(start.key);
  const b = getCameraFrame(end.key);
  return {
    key: local < 0.5 ? start.key : end.key,
    position: a.position.lerp(b.position, local),
    target: a.target.lerp(b.target, local),
    fov: mix(a.fov, b.fov, local),
  };
}

function setStatus(message, state = '') {
  const status = document.getElementById('sceneStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function cloneMaterial(material) {
  const next = material.clone();
  if (next.map) next.map.colorSpace = THREE.SRGBColorSpace;
  if (next.emissiveMap) next.emissiveMap.colorSpace = THREE.SRGBColorSpace;
  if ('envMapIntensity' in next) next.envMapIntensity = MATERIAL_CONFIG.defaultEnvMapIntensity;
  next.needsUpdate = true;
  return next;
}

function preserveModelMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = !lowPowerViewport;
    child.receiveShadow = true;
    if (Array.isArray(child.material)) {
      child.material = child.material.map(cloneMaterial);
    } else if (child.material) {
      child.material = cloneMaterial(child.material);
    }
  });
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
      material.needsUpdate = true;
    });
  });
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

  const drawCorner = (x, y, sx, sy) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.lineWidth = 9;
    ctx.strokeStyle = gold;
    ctx.beginPath();
    ctx.moveTo(0, 72);
    ctx.quadraticCurveTo(0, 16, 56, 16);
    ctx.moveTo(18, 92);
    ctx.quadraticCurveTo(24, 38, 82, 36);
    ctx.stroke();
    ctx.restore();
  };
  drawCorner(92, 94, 1, 1);
  drawCorner(width - 92, 94, -1, 1);
  drawCorner(92, height - 94, 1, -1);
  drawCorner(width - 92, height - 94, -1, -1);

  const cx = width / 2;
  const cross = new Path2D();
  cross.rect(cx - 32, 335, 64, 240);
  cross.rect(cx - 89, 411, 178, 58);
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#5c3b0b';
  ctx.lineWidth = 8;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
  ctx.shadowBlur = 16;
  ctx.stroke(cross);
  ctx.fill(cross);

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
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function getDecalPlacement(coverNode, face) {
  const isRightCover = coverNode.name.includes('cover-r');
  return {
    position: new THREE.Vector3(isRightCover ? 0.965 : -0.965, face < 0 ? 0.05 : -2.05, 0),
    rotation: new THREE.Euler(face < 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0),
    size: [1.56, 1.5],
  };
}

function attachCoverDecal(book, decal) {
  const targetName = APPROVED_BOOK_TRANSFORMS.cover.target;
  const coverNode = book.getObjectByName(targetName) || book.getObjectByName(targetName.replace(/_\d+$/, ''));
  if (!coverNode || !decal) return;

  const base = getDecalPlacement(coverNode, APPROVED_BOOK_TRANSFORMS.cover.face);
  coverNode.attach(decal);
  decal.geometry.dispose();
  decal.geometry = new THREE.PlaneGeometry(base.size[0], base.size[1]);
  decal.position.copy(base.position).add(toVec3(APPROVED_BOOK_TRANSFORMS.decal.position));
  decal.rotation.set(
    base.rotation.x + degToRad(APPROVED_BOOK_TRANSFORMS.decal.rotation[0]),
    base.rotation.y + degToRad(APPROVED_BOOK_TRANSFORMS.decal.rotation[1]),
    base.rotation.z + degToRad(APPROVED_BOOK_TRANSFORMS.decal.rotation[2]),
  );
  decal.scale.set(APPROVED_BOOK_TRANSFORMS.decal.scale[0], APPROVED_BOOK_TRANSFORMS.decal.scale[1], 1);
}

function applyBookTransform(bookRig) {
  bookRig.position.fromArray(APPROVED_BOOK_TRANSFORMS.book.position);
  bookRig.rotation.set(...APPROVED_BOOK_TRANSFORMS.book.rotation.map(degToRad));
  bookRig.scale.setScalar(APPROVED_BOOK_TRANSFORMS.book.scale);
}

function applyAltarTransform(altarRig) {
  altarRig.position.fromArray(APPROVED_SEQUENCE_CONFIG.altar.position);
  altarRig.rotation.set(...APPROVED_SEQUENCE_CONFIG.altar.rotation.map(degToRad));
  altarRig.scale.setScalar(APPROVED_SEQUENCE_CONFIG.altar.scale);
}

function applyChurchTransform(churchRoot) {
  churchRoot.position.fromArray(APPROVED_SEQUENCE_CONFIG.church.position);
  churchRoot.rotation.set(...APPROVED_SEQUENCE_CONFIG.church.rotation.map(degToRad));
  churchRoot.scale.setScalar(APPROVED_SEQUENCE_CONFIG.church.scale);
  churchRoot.visible = APPROVED_SEQUENCE_CONFIG.church.visible;
}

function getCropPlanes() {
  const crop = APPROVED_SEQUENCE_CONFIG.environment.crop;
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -crop.left),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), crop.right),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -crop.near),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), crop.far),
  ];
}

function updateHeroOverlay(progress) {
  const heroCopy = document.getElementById('heroCopy');
  const label = document.getElementById('timelineLabel');
  const heroIn = smoothstep(0.48, 0.62, progress);
  const heroOut = smoothstep(0.78, 0.9, progress);
  const heroOpacity = reducedMotion ? 1 : heroIn * (1 - heroOut);

  if (heroCopy) {
    heroCopy.style.opacity = String(heroOpacity);
    heroCopy.style.transform = `translate3d(0, ${mix(22, -38, heroOut)}px, 0)`;
    heroCopy.style.pointerEvents = heroOpacity > 0.4 ? 'auto' : 'none';
  }

  if (label) {
    label.textContent = '';
  }
}

function projectPageArea(id, config, opacity, camera, bookRig) {
  const element = document.getElementById(id);
  if (!element) return;
  element.style.setProperty('--page-overlay-opacity', opacity.toFixed(3));
  if (opacity <= 0.001) return;

  const area = new THREE.Object3D();
  area.position.fromArray(config.position);
  area.rotation.set(...config.rotation.map(degToRad));
  area.updateMatrix();
  const width = Math.max(0.05, config.scale[0]);
  const height = Math.max(0.05, config.scale[1]);
  const points = [
    new THREE.Vector3(-width / 2, 0, -height / 2),
    new THREE.Vector3(width / 2, 0, -height / 2),
    new THREE.Vector3(-width / 2, 0, height / 2),
    new THREE.Vector3(width / 2, 0, height / 2),
  ].map((point) => bookRig.localToWorld(point.applyMatrix4(area.matrix)).project(camera));

  if (!points.every((point) => point.z > -1 && point.z < 1)) {
    element.style.setProperty('--page-overlay-opacity', '0');
    return;
  }

  const screen = points.map((point) => ({
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
}

function updatePageOverlay(progress, camera, bookRig) {
  const overlay = document.getElementById('pageContentOverlay');
  if (!overlay || !bookRig) return;
  const reveal = reducedMotion ? 1 : smoothstep(0.93, 1, progress);
  const opacity = reveal * APPROVED_SEQUENCE_CONFIG.overlays.opacity;
  overlay.style.setProperty('--page-overlay-opacity', String(opacity));

  if (lowPowerViewport) return;
  projectPageArea('homeLeftPageSafeArea', APPROVED_SEQUENCE_CONFIG.overlays.left, opacity, camera, bookRig);
  projectPageArea('homeRightPageSafeArea', APPROVED_SEQUENCE_CONFIG.overlays.right, opacity, camera, bookRig);
}

function scrollProgress() {
  if (reducedMotion) return 1;
  const journey = document.getElementById('journey');
  if (!journey) return 0;
  const rect = journey.getBoundingClientRect();
  const max = Math.max(1, journey.offsetHeight - window.innerHeight);
  return clamp(-rect.top / max);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPowerViewport ? 1.2 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHTING_CONFIG.toneMappingExposure;
  renderer.shadowMap.enabled = !lowPowerViewport;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = getCropPlanes();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LIGHTING_CONFIG.fog.color);
  scene.fog = new THREE.FogExp2(
    LIGHTING_CONFIG.fog.color,
    lowPowerViewport ? LIGHTING_CONFIG.fog.mobileDensity : LIGHTING_CONFIG.fog.desktopDensity,
  );

  const initial = getTimelineFrame(0);
  const camera = new THREE.PerspectiveCamera(initial.fov, 1, 0.1, 80);
  camera.position.copy(initial.position);

  scene.add(new THREE.HemisphereLight(
    LIGHTING_CONFIG.hemisphere.skyColor,
    LIGHTING_CONFIG.hemisphere.groundColor,
    LIGHTING_CONFIG.hemisphere.intensity,
  ));
  const key = new THREE.DirectionalLight(LIGHTING_CONFIG.key.color, LIGHTING_CONFIG.key.intensity);
  key.position.fromArray(LIGHTING_CONFIG.key.position);
  key.castShadow = !lowPowerViewport;
  scene.add(key);

  const altarGlow = new THREE.SpotLight(
    LIGHTING_CONFIG.altarGlow.color,
    LIGHTING_CONFIG.altarGlow.intensity,
    LIGHTING_CONFIG.altarGlow.distance,
    LIGHTING_CONFIG.altarGlow.angle,
    LIGHTING_CONFIG.altarGlow.penumbra,
    LIGHTING_CONFIG.altarGlow.decay,
  );
  altarGlow.position.fromArray(LIGHTING_CONFIG.altarGlow.position);
  altarGlow.target.position.fromArray(LIGHTING_CONFIG.altarGlow.target);
  altarGlow.castShadow = !lowPowerViewport;
  scene.add(altarGlow, altarGlow.target);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  try {
    const [churchGltf, lecternGltf, bookGltf] = await Promise.all([
      loader.loadAsync(ASSETS.church),
      loader.loadAsync(ASSETS.lectern),
      loader.loadAsync(ASSETS.book),
    ]);

    const churchRoot = churchGltf.scene;
    preserveModelMaterials(churchRoot);
    applyChurchTransform(churchRoot);
    scene.add(churchRoot);

    const altarRig = new THREE.Group();
    altarRig.name = 'ApprovedLecternBibleAltarRig';
    applyAltarTransform(altarRig);
    scene.add(altarRig);

    const lectern = lecternGltf.scene;
    preserveModelMaterials(lectern);
    normalizeToGround(lectern, LECTERN_TRANSFORM.targetHeight);
    lectern.position.fromArray(LECTERN_TRANSFORM.position);
    lectern.rotation.set(...LECTERN_TRANSFORM.rotation.map(degToRad));
    altarRig.add(lectern);

    const bookRig = new THREE.Group();
    bookRig.name = 'BookRig';
    applyBookTransform(bookRig);
    altarRig.add(bookRig);

    const animatedBook = bookGltf.scene;
    preserveModelMaterials(animatedBook);
    bookRig.add(animatedBook);

    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        map: createCoverTexture(),
        transparent: true,
        opacity: MATERIAL_CONFIG.coverDecal.opacity,
        roughness: MATERIAL_CONFIG.coverDecal.roughness,
        metalness: MATERIAL_CONFIG.coverDecal.metalness,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    decal.name = 'MunadiCoverDecal';
    decal.renderOrder = 20;
    attachCoverDecal(animatedBook, decal);

    const mixer = new THREE.AnimationMixer(animatedBook);
    const clip = bookGltf.animations[0];
    const action = clip ? mixer.clipAction(clip) : null;
    if (action) {
      action.play();
      action.paused = true;
    }

    setStatus('Church sequence loaded.', 'ready');

    function resize() {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function updateScene(progress) {
      const frame = getTimelineFrame(progress);
      camera.position.copy(frame.position);
      camera.fov = frame.fov;
      camera.lookAt(frame.target);
      camera.updateProjectionMatrix();

      const openProgress = reducedMotion ? 1 : smoothstep(OPENING_CONFIG.scrollStart, OPENING_CONFIG.scrollEnd, progress);
      if (action && clip) {
        mixer.setTime(openProgress * clip.duration * OPENING_CONFIG.clipTimeRatio);
        mixer.update(0);
      }

      altarGlow.intensity = mix(
        LIGHTING_CONFIG.altarGlow.intensity,
        LIGHTING_CONFIG.altarGlow.finalIntensity,
        smoothstep(0.72, 1, progress),
      );
      updateHeroOverlay(progress);
      updatePageOverlay(progress, camera, bookRig);
    }

    let desiredProgress = scrollProgress();
    let renderedProgress = desiredProgress;
    let last = performance.now();

    function render(now) {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      desiredProgress = scrollProgress();
      renderedProgress = THREE.MathUtils.damp(renderedProgress, desiredProgress, reducedMotion ? 18 : 10, delta);
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
  } catch (error) {
    console.error(error);
    setStatus(`Scene failed to load: ${error.message}`, 'error');
  }
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

      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

document.documentElement.style.scrollBehavior = reducedMotion ? 'auto' : 'smooth';

setupScene();
setupNavSpy();
setupAnchorNavigation();
