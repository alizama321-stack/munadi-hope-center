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

const cameraTimeline = [
  // Debug: 00 Threshold - camera begins outside the wooden church door.
  { label: 'Threshold', at: 0, camera: [0, 1.55, 17], target: [0, 1.25, 8] },
  // Debug: 01 Through the door - pass the entrance without a scene cut.
  { label: 'Entering', at: 0.16, camera: [0, 1.58, 9.2], target: [0, 1.22, 3.2] },
  // Debug: 02 Aisle - slow travel through the church interior.
  { label: 'Aisle', at: 0.35, camera: [0.15, 1.62, 3.4], target: [0, 1.1, -4.6] },
  // Debug: 03 Lectern reveal - HTML hero copy appears while the lectern anchors right side.
  { label: 'Lectern', at: 0.55, camera: [-1.85, 1.55, -2.35], target: [1.2, 1.05, -6.25] },
  // Debug: 04 Hero hold - composition balances text left, lectern and closed Bible right.
  { label: 'Hero', at: 0.68, camera: [-2.28, 1.72, -4.5], target: [0.92, 1.55, -6.88] },
  // Debug: 05 Bible push - camera moves closer to the closed Bible.
  { label: 'Bible close', at: 0.83, camera: [-0.42, 2.38, -5.3], target: [1.03, 2.04, -7.02] },
  // Debug: 06 Open pages - closed Bible fades into open Bible as the content foundation.
  { label: 'Open pages', at: 1, camera: [0.62, 3.18, -5.0], target: [0.92, 2.12, -7.08] },
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

function getTimelinePoint(progress) {
  const p = reducedMotion ? 0.72 : clamp(progress);
  let start = cameraTimeline[0];
  let end = cameraTimeline[cameraTimeline.length - 1];

  for (let i = 0; i < cameraTimeline.length - 1; i += 1) {
    if (p >= cameraTimeline[i].at && p <= cameraTimeline[i + 1].at) {
      start = cameraTimeline[i];
      end = cameraTimeline[i + 1];
      break;
    }
  }

  const local = smoothstep(start.at, end.at, p);
  return {
    label: local < 0.5 ? start.label : end.label,
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

function modelOpacity(object, opacity) {
  object.visible = opacity > 0.01;
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = opacity > 0.85;
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
      material.needsUpdate = true;
      if ('roughness' in material) material.roughness = Math.max(material.roughness ?? 0.6, options.roughness ?? 0.72);
      if ('metalness' in material && options.metalness !== undefined) material.metalness = options.metalness;
    });
  });
}

function normalizeModel(object, targetSize, axis = 'y') {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(0.001, size[axis]);
  object.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(object);
  const center = scaledBox.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= scaledBox.min.y;
  return object;
}

function makeAisle() {
  const group = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 30, 1, 1),
    new THREE.MeshStandardMaterial({
      color: '#2b1208',
      roughness: 0.96,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0;
  floor.receiveShadow = true;
  group.add(floor);

  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 30, 1, 1),
    new THREE.MeshStandardMaterial({
      color: '#4d1910',
      roughness: 0.92,
      transparent: true,
      opacity: 0.62,
    }),
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.y = 0.012;
  runner.position.z = -0.2;
  group.add(runner);

  for (let i = 0; i < 7; i += 1) {
    const z = 8 - i * 3.2;
    [-3.2, 3.2].forEach((x) => {
      const pew = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.22, 0.52),
        new THREE.MeshStandardMaterial({ color: '#3a170b', roughness: 0.88 }),
      );
      pew.position.set(x, 0.45, z);
      pew.castShadow = true;
      pew.receiveShadow = true;
      group.add(pew);
    });
  }

  return group;
}

function createDust() {
  const count = lowPowerViewport ? 100 : 220;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = 0.8 + Math.random() * 3;
    positions[i * 3 + 2] = -8 + Math.random() * 24;
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
      opacity: 0.42,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}

async function loadModel(loader, key, path, required = true) {
  try {
    const gltf = await loader.loadAsync(path);
    return { key, model: gltf.scene, error: null };
  } catch (error) {
    if (required) {
      setStatus(`Scene asset failed to load: ${key}. Check ${path}`, 'error');
    }
    return { key, model: null, error };
  }
}

function updateHeroOverlay(progress) {
  const heroCopy = document.getElementById('heroCopy');
  const openPages = document.querySelector('.page-panel');
  const label = document.getElementById('timelineLabel');

  const heroIn = smoothstep(0.42, 0.56, progress);
  const heroOut = smoothstep(0.74, 0.9, progress);
  const heroOpacity = reducedMotion ? 1 : heroIn * (1 - heroOut);

  if (heroCopy) {
    heroCopy.style.opacity = String(heroOpacity);
    heroCopy.style.transform = `translate3d(0, ${mix(28, -48, heroOut)}px, 0)`;
    heroCopy.style.pointerEvents = heroOpacity > 0.5 ? 'auto' : 'none';
  }

  if (openPages) {
    const pagesIn = smoothstep(0.86, 1, progress);
    openPages.style.setProperty('--page-progress', String(reducedMotion ? 1 : pagesIn));
  }

  if (label) {
    const point = getTimelinePoint(progress);
    label.textContent = debugMode ? `${Math.round(progress * 100)}% - ${point.label}` : point.label;
  }
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !lowPowerViewport;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#180806');
  scene.fog = new THREE.FogExp2('#190806', lowPowerViewport ? 0.075 : 0.052);

  const camera = new THREE.PerspectiveCamera(lowPowerViewport ? 44 : 38, 1, 0.1, 80);
  const target = new THREE.Vector3();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  scene.add(new THREE.HemisphereLight('#fff0c8', '#120503', 1.15));
  const key = new THREE.DirectionalLight('#ffd38d', 2.6);
  key.position.set(-4, 7, 9);
  key.castShadow = !lowPowerViewport;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const sanctuaryGlow = new THREE.SpotLight('#f0ad5a', 4.2, 28, 0.36, 0.75, 1.2);
  sanctuaryGlow.position.set(1.6, 5.4, -3.2);
  sanctuaryGlow.target.position.set(0, 0.7, -7);
  sanctuaryGlow.castShadow = !lowPowerViewport;
  scene.add(sanctuaryGlow, sanctuaryGlow.target);

  const doorGlow = new THREE.PointLight('#ffc271', 2.4, 12, 1.6);
  doorGlow.position.set(0, 2.2, 9.5);
  scene.add(doorGlow);

  const world = new THREE.Group();
  scene.add(world);
  world.add(makeAisle());

  const dust = createDust();
  scene.add(dust);

  const loadList = [
    loadModel(loader, 'door', ASSETS.door),
    lowPowerViewport ? Promise.resolve({ key: 'interior', model: null, skipped: true }) : loadModel(loader, 'interior', ASSETS.interior, false),
    loadModel(loader, 'lectern', ASSETS.lectern),
    loadModel(loader, 'closedBible', ASSETS.closedBible),
    loadModel(loader, 'openBible', ASSETS.openBible),
  ];

  const results = await Promise.all(loadList);
  const loaded = Object.fromEntries(results.map((result) => [result.key, result]));
  const failures = results.filter((result) => result.error);
  if (failures.length) {
    setStatus(`Loaded with ${failures.length} asset issue${failures.length > 1 ? 's' : ''}. See console for details.`, 'error');
    failures.forEach((failure) => console.error(`Failed to load ${failure.key}`, failure.error));
  } else {
    setStatus(lowPowerViewport ? 'Mobile scene loaded with lighter environment.' : 'Church scene loaded.', 'ready');
  }

  if (loaded.interior?.model) {
    const interior = normalizeModel(loaded.interior.model, 5.2, 'y');
    tuneMaterials(interior, { envMapIntensity: 0.35, roughness: 0.88 });
    interior.position.set(0, 0, 0.5);
    interior.rotation.y = Math.PI;
    world.add(interior);
  }

  if (loaded.door?.model) {
    const door = normalizeModel(loaded.door.model, 4.6, 'y');
    tuneMaterials(door, { envMapIntensity: 0.4, roughness: 0.82 });
    door.position.set(0, 0, 8.75);
    door.rotation.y = Math.PI;
    world.add(door);
  }

  const altar = new THREE.Group();
  altar.position.set(1.05, 0, -7.2);
  altar.rotation.y = -0.22;
  world.add(altar);

  if (loaded.lectern?.model) {
    const lectern = normalizeModel(loaded.lectern.model, 2.05, 'y');
    tuneMaterials(lectern, { envMapIntensity: 0.65, roughness: 0.72 });
    altar.add(lectern);
  }

  const closedBibleGroup = new THREE.Group();
  closedBibleGroup.position.set(0.02, 1.97, 0.18);
  closedBibleGroup.rotation.set(-0.18, -0.08, 0);
  altar.add(closedBibleGroup);

  if (loaded.closedBible?.model) {
    const closedBible = normalizeModel(loaded.closedBible.model, 0.42, 'z');
    tuneMaterials(closedBible, { envMapIntensity: 0.95, roughness: 0.74 });
    closedBible.rotation.set(0, Math.PI * 0.5, 0);
    closedBibleGroup.add(closedBible);
  }

  const openBibleGroup = new THREE.Group();
  openBibleGroup.position.set(0.02, 2.18, 0.16);
  openBibleGroup.rotation.set(-0.12, -0.04, 0);
  altar.add(openBibleGroup);

  if (loaded.openBible?.model) {
    const openBible = loaded.openBible.model;
    openBible.rotation.set(-Math.PI / 2, 0, Math.PI);
    normalizeModel(openBible, 1.25, 'x');
    tuneMaterials(openBible, { envMapIntensity: 0.9, roughness: 0.78 });
    openBibleGroup.add(openBible);
    modelOpacity(openBibleGroup, 0);
  }

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function scrollProgress() {
    if (reducedMotion) return 0.9;
    const journey = document.getElementById('journey');
    if (!journey) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp(window.scrollY / max);
    }
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

    const reveal = smoothstep(0.76, 0.92, progress);
    modelOpacity(closedBibleGroup, 1 - reveal);
    modelOpacity(openBibleGroup, reveal);
    openBibleGroup.scale.setScalar(mix(0.62, lowPowerViewport ? 0.82 : 0.86, reveal));
    openBibleGroup.position.y = mix(2.18, 2.2, reveal);
    altar.rotation.y = mix(-0.22, -0.04, reveal);

    sanctuaryGlow.intensity = mix(3.2, 5.6, reveal);
    doorGlow.intensity = mix(2.4, 0.45, smoothstep(0.12, 0.42, progress));
    dust.position.z = mix(0, -1.2, progress);
    updateHeroOverlay(progress);
  }

  function render(now) {
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    desiredProgress = scrollProgress();
    renderedProgress = THREE.MathUtils.damp(renderedProgress, desiredProgress, reducedMotion ? 18 : 12, delta);
    dust.rotation.y += delta * 0.018;
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

function setupRevealObserver() {
  const revealEls = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  revealEls.forEach((el) => observer.observe(el));
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
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

document.documentElement.classList.toggle('debug-scene', debugMode);
document.documentElement.style.scrollBehavior = reducedMotion ? 'auto' : 'smooth';

setupScene();
setupRevealObserver();
setupNavSpy();
setupAnchorNavigation();
