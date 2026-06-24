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
        position: [0, 1.95, 7.25],
        target: [0, 2.1, 2.8],
        fov: 50,
        distance: 1,
      },
      aisle_reveal: {
        position: [0, 1.85, 4.65],
        target: [0, 2.55, -3],
        fov: 62,
        distance: 1,
      },
      aisle_walk_mid: {
        position: [0, 1.88, 2.05],
        target: [0, 2.35, -3.25],
        fov: 48,
        distance: 1,
      },
      altar_approach: {
        position: [0, 2.02, -0.75],
        target: [0, 2.18, -3.5],
        fov: 36,
        distance: 1,
      },
      lectern_end_point: {
        position: [0, 2.18, -2],
        target: [0, 2.16, -3.55],
        fov: 30,
        distance: 1,
      },
      bible_closeup: {
        position: [-0.12, 3.08, -3.04],
        target: [0, 2.26, -3.55],
        fov: 22,
        distance: 1,
      },
      bible_open_pages: {
        position: [0, 3.18, -3.5],
        target: [0, 2.18, -3.55],
        fov: 24,
        distance: 1,
      },
    },
  },
  altar: {
    position: [0, 0, -3.55],
    rotation: [0, 180, 0],
    scale: 1,
  },
  lectern: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    targetHeight: 2.05,
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
