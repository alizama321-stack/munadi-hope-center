export const APPROVED_BOOK_TRANSFORMS = {
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

export const APPROVED_SEQUENCE_CONFIG = {
  progress: 0,
  book: APPROVED_BOOK_TRANSFORMS,
  camera: {
    presets: {
      gate_entry: {
        position: [-0.5, 0.3, -1.5],
        target: [-29.1, -0.5, -1.65],
        fov: 70,
        distance: 1.16,
      },
      aisle_reveal: {
        position: [4.0724, 0.5425, -1.476],
        target: [-29.1, -0.5, -1.65],
        fov: 70,
        distance: 0.87,
      },
      aisle_walk_mid: {
        position: [-0.65, 0.25, -0.95],
        target: [-29.1, -0.5, -1.6],
        fov: 70,
        distance: 0.93,
      },
      altar_approach: {
        position: [-7.2, 0.85, -0.6],
        target: [-4, -0.4, -3],
        fov: 40,
        distance: 0.71,
      },
      lectern_end_point: {
        position: [-12.85, 7.85, -2],
        target: [-2.8, -2.35, -1.9],
        fov: 34,
        distance: 0.34,
      },
      bible_closeup: {
        position: [-12.85, 7.85, -2],
        target: [-2.8, -2.35, -1.9],
        fov: 34,
        distance: 0.34,
      },
      bible_open_pages: {
        position: [-12.85, 7.85, -2],
        target: [-2.8, -2.35, -1.9],
        fov: 34,
        distance: 0.34,
      },
      bible_content_view: {
        position: [-12.85, 7.85, -2],
        target: [-2.8, -2.35, -1.9],
        fov: 34,
        distance: 0.34,
      },
    },
  },
  altar: {
    position: [-5.45, -1.05, -1.6],
    rotation: [0, 269, 0],
    scale: 0.64,
  },
  lectern: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    targetHeight: 2.05,
  },
  gateDoor: {
    position: [1.2, -1.05, -1.48],
    rotation: [0, 90, 0],
    targetHeight: 3.9,
    fadeStart: 0.08,
    fadeEnd: 0.2,
    churchRevealStart: 0.08,
    churchRevealEnd: 0.18,
  },
  church: {
    position: [0, -0.2, 0],
    rotation: [0, 0, 0],
    scale: 0.82,
    visible: true,
  },
  environment: {
    fog: 0.038,
    darkness: 0.42,
    crop: {
      left: -8,
      right: 8,
      near: -8,
      far: 6,
    },
  },
  opening: {
    clipTimeRatio: 0.5,
    scrollStart: 0.82,
    scrollEnd: 0.98,
  },
  smoothing: {
    cameraDamping: 3.2,
    targetDamping: 3.8,
    fovDamping: 4.5,
    animationDamping: 3.2,
    scrollDamping: 6,
  },
  lighting: {
    toneMappingExposure: 1.05,
    fog: {
      color: '#090403',
      desktopDensity: 0.038,
      mobileDensity: 0.065,
    },
    hemisphere: {
      skyColor: '#fff0cc',
      groundColor: '#160604',
      intensity: 1.15,
    },
    key: {
      color: '#ffd18a',
      intensity: 2.8,
      position: [-3.2, 5.2, 4.6],
    },
    altarGlow: {
      color: '#f3b45e',
      intensity: 4.5,
      finalIntensity: 4.6,
      distance: 16,
      angle: 0.5,
      penumbra: 0.75,
      decay: 1.2,
      position: [2.4, 4.2, 2.6],
      target: [0, 1.8, 0],
    },
  },
  materials: {
    defaultEnvMapIntensity: 0.72,
    coverDecal: {
      opacity: 0.96,
      roughness: 0.38,
      metalness: 0.36,
    },
  },
  overlays: {
    opacity: 1,
    borderVisible: false,
    left: {
      position: [-0.9, -0.46, -0.08],
      rotation: [0, 0, 0],
      scale: [1.72, 1.62],
    },
    right: {
      position: [0.5, -0.46, -0.03],
      rotation: [0, 0, 0],
      scale: [1.64, 1.62],
    },
  },
  content: {
    start: 0.9,
    end: 1,
    pageCoverStart: 0.82,
    pageCoverEnd: 0.96,
  },
};
