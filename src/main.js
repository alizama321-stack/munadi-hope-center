import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(canvas.width, canvas.height);

  for (let i = 0; i < image.data.length; i += 4) {
    const grain = Math.random();
    if (kind === 'paper') {
      image.data[i] = 232 + grain * 18;
      image.data[i + 1] = 211 + grain * 22;
      image.data[i + 2] = 166 + grain * 28;
      image.data[i + 3] = 255;
    } else {
      image.data[i] = 32 + grain * 38;
      image.data[i + 1] = 12 + grain * 16;
      image.data[i + 2] = 7 + grain * 12;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  if (kind === 'paper') {
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 340; i += 1) {
      ctx.fillStyle = i % 3 ? '#8d5a29' : '#ba9148';
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 4 + 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 0.18;
    for (let y = 16; y < canvas.height; y += 12 + Math.random() * 10) {
      ctx.strokeStyle = Math.random() > 0.5 ? '#c8a971' : '#fff0ca';
      ctx.lineWidth = Math.random() * 1.2 + 0.25;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(canvas.width * 0.28, y + Math.random() * 7 - 3.5, canvas.width * 0.72, y + Math.random() * 7 - 3.5, canvas.width, y);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.26;
    for (let i = 0; i < 1450; i += 1) {
      ctx.strokeStyle = i % 3 ? '#140705' : '#6d301b';
      ctx.lineWidth = Math.random() * 1.1 + 0.18;
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + Math.random() * 70 - 35,
        y + Math.random() * 44 - 22,
        x + Math.random() * 110 - 55,
        y + Math.random() * 68 - 34,
        x + Math.random() * 150 - 75,
        y + Math.random() * 88 - 44,
      );
      ctx.stroke();
    }

    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 900; i += 1) {
      const size = Math.random() * 2.2 + 0.5;
      ctx.fillStyle = Math.random() > 0.52 ? '#0d0302' : '#8a482b';
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, size, size);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'paper' ? 3.4 : 2.1, kind === 'paper' ? 3.4 : 2.1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCoverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1400;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#4b1a10');
  gradient.addColorStop(0.38, '#2e1009');
  gradient.addColorStop(0.78, '#1c0905');
  gradient.addColorStop(1, '#080202');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 2200; i += 1) {
    ctx.strokeStyle = i % 2 ? '#090202' : '#73351f';
    ctx.lineWidth = Math.random() * 1.2 + 0.2;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.random() * 70 - 35, y + Math.random() * 50 - 25, x + Math.random() * 130 - 65, y + Math.random() * 80 - 40);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.34;
  for (let i = 0; i < 140; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const len = Math.random() * 110 + 18;
    ctx.strokeStyle = Math.random() > 0.42 ? '#070202' : '#8f5638';
    ctx.lineWidth = Math.random() * 1.4 + 0.28;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + Math.random() * 12 - 6);
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(canvas.width * 0.48, canvas.height * 0.48, 80, canvas.width * 0.48, canvas.height * 0.48, canvas.height * 0.72);
  vignette.addColorStop(0, 'rgba(255,255,255,0.08)');
  vignette.addColorStop(0.55, 'rgba(0,0,0,0.04)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(215, 164, 61, 0.58)';
  ctx.lineWidth = 16;
  ctx.strokeRect(80, 86, canvas.width - 160, canvas.height - 172);
  ctx.strokeStyle = 'rgba(66, 31, 12, 0.82)';
  ctx.lineWidth = 7;
  ctx.strokeRect(98, 104, canvas.width - 196, canvas.height - 208);

  ctx.globalAlpha = 0.65;
  ctx.fillStyle = '#a36c36';
  [
    [40, 42, 190, 28],
    [canvas.width - 230, 42, 190, 28],
    [42, canvas.height - 78, 190, 28],
    [canvas.width - 232, canvas.height - 78, 190, 28],
    [34, 64, 28, 170],
    [canvas.width - 62, 64, 28, 170],
    [34, canvas.height - 234, 28, 170],
    [canvas.width - 62, canvas.height - 234, 28, 170],
  ].forEach(([x, y, w, h]) => {
    const wear = ctx.createLinearGradient(x, y, x + w, y + h);
    wear.addColorStop(0, 'rgba(186, 126, 61, 0.62)');
    wear.addColorStop(1, 'rgba(49, 19, 8, 0)');
    ctx.fillStyle = wear;
    ctx.fillRect(x, y, w, h);
  });

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#d9a846';
  ctx.fillRect(canvas.width / 2 - 23, 278, 46, 270);
  ctx.fillRect(canvas.width / 2 - 152, 342, 304, 42);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d7a13a';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.68)';
  ctx.shadowBlur = 13;
  ctx.shadowOffsetY = 9;
  ctx.font = '700 96px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Munadi', canvas.width / 2, 720);
  ctx.font = '700 82px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Hope Center', canvas.width / 2, 812);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#fff1b0';
  ctx.font = '700 92px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Munadi', canvas.width / 2 - 2, 716);
  ctx.font = '700 78px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Hope Center', canvas.width / 2 - 2, 808);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = '700 30px Inter, Arial, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillStyle = '#c99432';
  ctx.fillText('FAITH  HOPE  COMMUNITY', canvas.width / 2, 934);
  ctx.fillRect(canvas.width / 2 - 180, 1005, 360, 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makePageEdgeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#aa7d43');
  gradient.addColorStop(0.18, '#d5b276');
  gradient.addColorStop(0.5, '#f2d9a4');
  gradient.addColorStop(0.82, '#c79e5d');
  gradient.addColorStop(1, '#815225');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 6; y < canvas.height; y += 5 + Math.random() * 7) {
    ctx.globalAlpha = 0.28 + Math.random() * 0.18;
    ctx.strokeStyle = Math.random() > 0.5 ? '#6d4824' : '#fff0bf';
    ctx.lineWidth = Math.random() * 1.1 + 0.25;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(canvas.width * 0.35, y + Math.random() * 2 - 1, canvas.width * 0.75, y + Math.random() * 2 - 1, canvas.width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 90; i += 1) {
    ctx.fillStyle = '#6f431e';
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2.6 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1.2);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRoundedBox(width, height, depth, radius, material) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 8, radius);
  return new THREE.Mesh(geometry, material);
}

function createLine(width, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, 0.009), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function createRaisedDetail(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function addCoverBar(group, material, x, y, width, height, depth = 0.038) {
  const mesh = createRaisedDetail(width, height, depth, material, 1.7 + x, y, 0.168);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function addWornPatch(group, material, x, y, width, height) {
  const mesh = createRaisedDetail(width, height, 0.012, material, 1.7 + x, y, 0.184);
  mesh.castShadow = false;
  group.add(mesh);
  return mesh;
}

function makePageEdgeMaterial(index) {
  const palette = ['#d9bd80', '#efd8a4', '#cba86a', '#f3e0b6', '#b99057'];
  return new THREE.MeshStandardMaterial({
    color: palette[index % palette.length],
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: 0.56,
  });
}

function createDustField() {
  const count = 90;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 6.2;
    positions[i * 3 + 1] = Math.random() * 4.3 - 1.75;
    positions[i * 3 + 2] = Math.random() * 3.2 - 1.2;
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 0.78 + Math.random() * 0.12;
    colors[i * 3 + 2] = 0.42 + Math.random() * 0.18;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.018,
    transparent: true,
    opacity: 0.38,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function setupBookScene(reducedMotion) {
  const canvas = document.getElementById('bookCanvas');
  const visual = document.getElementById('bookVisual');
  const hero = document.querySelector('.cinematic-hero');
  const heroCopy = document.getElementById('heroCopy');
  const pageWash = document.getElementById('pageWash');

  if (!canvas || !visual) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#2b1007', 0.035);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  const root = new THREE.Group();
  scene.add(root);

  const leather = makeTexture('leather');
  const coverTexture = makeCoverTexture();
  const paper = makeTexture('paper');
  const pageEdgeTexture = makePageEdgeTexture();

  const leatherMaterial = new THREE.MeshPhysicalMaterial({
    map: leather,
    bumpMap: leather,
    bumpScale: 0.09,
    color: '#241009',
    roughness: 0.9,
    metalness: 0.015,
    sheen: 0.42,
    sheenRoughness: 0.9,
    clearcoat: 0.06,
    clearcoatRoughness: 0.82,
  });
  const darkLeatherMaterial = new THREE.MeshPhysicalMaterial({
    map: leather,
    bumpMap: leather,
    bumpScale: 0.08,
    color: '#160705',
    roughness: 0.94,
    sheen: 0.25,
    sheenRoughness: 0.95,
  });
  const coverMaterial = new THREE.MeshPhysicalMaterial({
    map: coverTexture,
    bumpMap: leather,
    bumpScale: 0.085,
    color: '#ffffff',
    roughness: 0.84,
    metalness: 0.02,
    sheen: 0.5,
    sheenRoughness: 0.88,
    clearcoat: 0.05,
    clearcoatRoughness: 0.8,
  });
  const paperMaterial = new THREE.MeshStandardMaterial({ map: paper, bumpMap: paper, bumpScale: 0.035, color: '#ead2a0', roughness: 0.98 });
  const pageLineMaterial = new THREE.MeshStandardMaterial({ color: '#7a5c35', roughness: 0.98, transparent: true, opacity: 0.36 });
  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: '#d7a13a',
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 0.25,
    clearcoatRoughness: 0.18,
  });
  const dullGoldMaterial = new THREE.MeshPhysicalMaterial({ color: '#9d7028', metalness: 0.64, roughness: 0.42 });
  const edgeWearMaterial = new THREE.MeshStandardMaterial({ color: '#9a6031', roughness: 0.92, transparent: true, opacity: 0.7 });
  const pageEdgeBaseMaterial = new THREE.MeshStandardMaterial({ map: pageEdgeTexture, color: '#f2d39c', roughness: 0.98 });

  const backCover = createRoundedBox(3.36, 4.52, 0.24, 0.09, leatherMaterial);
  backCover.position.set(0, -0.05, -0.16);
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  root.add(backCover);

  const pageBlock = createRoundedBox(3.08, 4.12, 0.5, 0.035, paperMaterial);
  pageBlock.position.set(0.09, -0.02, 0.02);
  pageBlock.castShadow = true;
  pageBlock.receiveShadow = true;
  root.add(pageBlock);

  const pageEdgeRight = new THREE.Mesh(new THREE.BoxGeometry(0.11, 3.96, 0.52), pageEdgeBaseMaterial);
  pageEdgeRight.position.set(1.73, -0.02, 0.075);
  pageEdgeRight.castShadow = true;
  pageEdgeRight.receiveShadow = true;
  root.add(pageEdgeRight);

  const topEdge = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.055, 0.5), new THREE.MeshStandardMaterial({ color: '#d6b16f', roughness: 0.98 }));
  topEdge.position.set(0.12, 1.96, 0.08);
  topEdge.castShadow = true;
  topEdge.receiveShadow = true;
  root.add(topEdge);

  const pageEdges = new THREE.Group();
  for (let i = 0; i < 42; i += 1) {
    const y = -1.88 + i * 0.091 + Math.sin(i * 1.7) * 0.004;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.018 + (i % 5) * 0.002, 0.005, 0.49), makePageEdgeMaterial(i));
    strip.position.set(1.815 + Math.sin(i * 0.9) * 0.003, y, 0.098 + Math.cos(i * 1.3) * 0.002);
    strip.castShadow = false;
    strip.receiveShadow = true;
    pageEdges.add(strip);
  }
  for (let i = 0; i < 26; i += 1) {
    const x = -1.18 + i * 0.098;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.058, 0.01), makePageEdgeMaterial(i + 9));
    strip.position.set(x, 1.992 + Math.sin(i) * 0.003, 0.34);
    pageEdges.add(strip);
  }
  root.add(pageEdges);

  for (let i = 0; i < 12; i += 1) {
    root.add(createLine(1.9 - (i % 4) * 0.18, pageLineMaterial, 0.55, 1.24 - i * 0.205, 0.408));
  }
  root.add(createLine(0.42, goldMaterial, -0.48, 0.87, 0.372));
  root.add(createLine(0.42, goldMaterial, -0.48, -1.02, 0.372));

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.48, 0.48), darkLeatherMaterial);
  spine.position.set(-1.67, -0.02, 0.04);
  spine.castShadow = true;
  spine.receiveShadow = true;
  root.add(spine);

  [-1.42, -0.78, 0.02, 0.82, 1.46].forEach((y, index) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.105, 0.54), index % 2 ? leatherMaterial : darkLeatherMaterial);
    band.position.set(-1.665, y, 0.08);
    band.castShadow = true;
    band.receiveShadow = true;
    root.add(band);
  });

  [-1.68, -0.46, 0.46, 1.68].forEach((y) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.57), dullGoldMaterial);
    line.position.set(-1.665, y, 0.105);
    line.castShadow = true;
    root.add(line);
  });

  const pages = [];
  for (let i = 0; i < 5; i += 1) {
    const pivot = new THREE.Group();
    pivot.position.set(-1.55, 0, 0.34 + i * 0.012);
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.96, 4.02, 0.018), paperMaterial.clone());
    sheet.position.set(1.48, 0, 0);
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    pivot.add(sheet);
    const leadingEdge = new THREE.Mesh(new THREE.BoxGeometry(0.032, 3.94, 0.024), makePageEdgeMaterial(i + 18));
    leadingEdge.position.set(2.95, 0, 0.012);
    leadingEdge.castShadow = true;
    pivot.add(leadingEdge);
    root.add(pivot);
    pages.push(pivot);
  }

  const coverPivot = new THREE.Group();
  coverPivot.position.set(-1.7, -0.05, 0.29);
  const cover = createRoundedBox(3.4, 4.58, 0.24, 0.095, coverMaterial);
  cover.position.set(1.7, 0, 0);
  cover.castShadow = true;
  cover.receiveShadow = true;
  coverPivot.add(cover);
  const coverLip = createRoundedBox(3.02, 4.16, 0.018, 0.06, new THREE.MeshStandardMaterial({ color: '#4a1c0e', roughness: 0.9, transparent: true, opacity: 0.18 }));
  coverLip.position.set(1.7, 0, 0.133);
  coverPivot.add(coverLip);
  addCoverBar(coverPivot, goldMaterial, 0, 0.87, 0.085, 0.8);
  addCoverBar(coverPivot, goldMaterial, 0, 1.02, 0.62, 0.07);
  addCoverBar(coverPivot, dullGoldMaterial, 0, -1.06, 1.02, 0.035, 0.022);
  addCoverBar(coverPivot, dullGoldMaterial, 0, 1.86, 2.72, 0.035, 0.022);
  addCoverBar(coverPivot, dullGoldMaterial, 0, -1.86, 2.72, 0.035, 0.022);
  addCoverBar(coverPivot, dullGoldMaterial, -1.36, 0, 0.035, 3.72, 0.022);
  addCoverBar(coverPivot, dullGoldMaterial, 1.36, 0, 0.035, 3.72, 0.022);
  addWornPatch(coverPivot, edgeWearMaterial, -1.42, 1.98, 0.42, 0.055);
  addWornPatch(coverPivot, edgeWearMaterial, 1.42, 1.98, 0.42, 0.055);
  addWornPatch(coverPivot, edgeWearMaterial, -1.42, -1.98, 0.42, 0.055);
  addWornPatch(coverPivot, edgeWearMaterial, 1.42, -1.98, 0.42, 0.055);
  addWornPatch(coverPivot, edgeWearMaterial, -1.58, 1.72, 0.055, 0.42);
  addWornPatch(coverPivot, edgeWearMaterial, 1.58, 1.72, 0.055, 0.42);
  addWornPatch(coverPivot, edgeWearMaterial, -1.58, -1.72, 0.055, 0.42);
  addWornPatch(coverPivot, edgeWearMaterial, 1.58, -1.72, 0.055, 0.42);
  root.add(coverPivot);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.85, 96),
    new THREE.MeshStandardMaterial({ color: '#2b1007', transparent: true, opacity: 0.35, roughness: 1, depthWrite: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.54, -0.3);
  floor.scale.set(1.35, 0.45, 1);
  floor.receiveShadow = true;
  scene.add(floor);

  const dust = createDustField();
  scene.add(dust);

  scene.add(new THREE.AmbientLight('#fff2d5', 0.34));
  const hemi = new THREE.HemisphereLight('#fff2c8', '#190805', 0.86);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffd993', 2.35);
  key.position.set(-3.4, 4.8, 5.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  scene.add(key);
  const spot = new THREE.SpotLight('#f7c66a', 3.6, 14, 0.36, 0.78);
  spot.position.set(3.4, 4.9, 4.8);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  scene.add(spot);
  const warmRim = new THREE.DirectionalLight('#8f3d18', 0.75);
  warmRim.position.set(4.8, 1.2, -2.8);
  scene.add(warmRim);

  let progress = reducedMotion ? 0.72 : 0;
  let renderedProgress = progress;
  let previousTime = performance.now();

  function resize() {
    const rect = visual.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateBook(p) {
    const lift = smoothstep(0.03, 0.18, p);
    const open = smoothstep(0.18, 0.66, p);
    const settle = smoothstep(0.66, 1, p);

    root.position.y = lerp(-0.12, 0.22, lift) - settle * 0.06;
    root.position.x = lerp(0.18, -0.1, settle);
    root.rotation.x = lerp(-0.16, -0.04, settle);
    root.rotation.y = lerp(-0.42, -0.08, settle);
    root.rotation.z = lerp(0.035, -0.015, settle);
    const scale = lerp(0.93, 1.08, lift) + settle * 0.08;
    root.scale.setScalar(scale);

    coverPivot.rotation.y = lerp(0, -2.54, open);
    pageBlock.rotation.x = lerp(0, -0.035, settle);
    pageBlock.scale.x = lerp(1, 1.04, settle);
    pageBlock.scale.y = lerp(1, 1.02, settle);

    pages.forEach((page, index) => {
      const turn = smoothstep(0.45 + index * 0.025, 0.82 + index * 0.025, p);
      page.rotation.y = lerp(0, -2.38 + index * 0.035, turn);
    });

    const mobile = visual.clientWidth < 520;
    const start = mobile ? [0.15, 0.05, 8.2] : [0.34, 0.08, 7.3];
    const end = mobile ? [0.05, 0.1, 7.1] : [-0.18, 0.12, 6.05];
    camera.position.set(
      lerp(start[0], end[0], settle),
      lerp(start[1], end[1], settle),
      lerp(start[2], end[2], settle),
    );
    camera.lookAt(0.1, 0.03, 0);
  }

  function render(now) {
    const delta = Math.min(0.05, (now - previousTime) / 1000);
    previousTime = now;
    renderedProgress = THREE.MathUtils.damp(renderedProgress, progress, 8, delta);
    dust.rotation.y += delta * 0.018;
    dust.rotation.x = Math.sin(now * 0.00018) * 0.018;
    spot.intensity = 3.45 + Math.sin(now * 0.0007) * 0.12;
    updateBook(renderedProgress);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  function setHeroProgress(value) {
    progress = reducedMotion ? 0.72 : value;
    const p = progress;
    const textExit = smoothstep(0.08, 0.42, p);
    const washIn = smoothstep(0.62, 0.95, p);

    if (heroCopy) {
      heroCopy.style.opacity = String(lerp(1, 0, textExit));
      heroCopy.style.transform = `translate3d(0, ${lerp(0, -84, textExit)}px, 0)`;
    }
    if (visual) {
      visual.style.transform = `translate3d(${lerp(0, -22, washIn)}px, ${lerp(0, -14, washIn)}px, 0) scale(${lerp(1, 1.04, washIn)})`;
    }
    if (pageWash) {
      pageWash.style.opacity = String(lerp(0, 0.94, washIn));
      pageWash.style.transform = `translate3d(-50%, ${lerp(80, 0, washIn)}px, 0) scaleX(${lerp(0.3, 1, washIn)})`;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(render);

  if (reducedMotion) {
    setHeroProgress(0.72);
    if (heroCopy) {
      heroCopy.style.opacity = '1';
      heroCopy.style.transform = 'none';
    }
    if (pageWash) pageWash.style.opacity = '0.58';
    return;
  }

  if (gsap && ScrollTrigger && hero) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: '+=185%',
      pin: true,
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => setHeroProgress(self.progress),
    });
  } else {
    window.addEventListener('scroll', () => {
      const rect = hero.getBoundingClientRect();
      const total = window.innerHeight * 1.85;
      setHeroProgress(clamp(-rect.top / total));
    }, { passive: true });
  }
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
  }, { threshold: 0.45 });

  sections.forEach((section) => observer.observe(section));
}

function setupForm() {
  const form = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (success) success.classList.add('show');
    const button = form.querySelector('.btn-primary');
    if (button) {
      button.textContent = 'Message Sent';
      button.setAttribute('disabled', 'disabled');
    }
    form.querySelectorAll('input, select, textarea').forEach((field) => {
      field.setAttribute('disabled', 'disabled');
    });
  });
}

function setupPastorFallback() {
  const image = document.querySelector('.pastor-photo img');
  if (!image) return;
  image.addEventListener('error', () => {
    image.style.display = 'none';
    const fallback = image.nextElementSibling;
    if (fallback) fallback.style.display = 'flex';
  });
}

function setupAnchorNavigation(pendingHash) {
  const scrollToHash = (hash, behavior = 'smooth') => {
    const id = hash.replace(/^#/, '');
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    if (ScrollTrigger) ScrollTrigger.refresh();
    target.scrollIntoView({ behavior, block: 'start' });
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const hash = link.getAttribute('href');
      if (!hash || hash === '#') return;
      event.preventDefault();
      history.pushState(null, '', hash);
      scrollToHash(hash);
    });
  });

  const startingHash = pendingHash || window.location.hash;
  if (startingHash && startingHash !== '#chapter-1') {
    window.setTimeout(() => {
      history.replaceState(null, '', startingHash);
      scrollToHash(startingHash, 'auto');
    }, 850);
  }
}

const pendingHash = window.location.hash && window.location.hash !== '#chapter-1' ? window.location.hash : '';
if (pendingHash) {
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  window.scrollTo(0, 0);
}

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
document.documentElement.style.scrollBehavior = reducedQuery.matches ? 'auto' : 'smooth';

setupBookScene(reducedQuery.matches);
setupRevealObserver();
setupNavSpy();
setupForm();
setupPastorFallback();
setupAnchorNavigation(pendingHash);
