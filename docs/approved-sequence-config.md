# Approved Sequence Config

This file documents the locked Sequence Lab values used by the public homepage.

The canonical source is:

`src/approved-sequence-config.js`

The public homepage imports `APPROVED_SEQUENCE_CONFIG` directly. It does not read Sequence Lab `localStorage`.

## LocalStorage Check

Before locking the config, local browser/app storage was searched for:

- `munadiHopeCenter.sequenceLab.v2.sequence`
- `munadiHopeCenter.sequenceLab.sequence`

No readable saved override was found in the local app/browser storage during this pass, so the approved values were locked from the current approved Sequence Lab source defaults. The homepage no longer depends on browser `localStorage`.

`localStorage` remains available inside `/sequence-lab` only for future tuning.

## Camera Presets

| Preset | Position | Target | FOV |
| --- | --- | --- | --- |
| `gate_entry` | `[-0.5, 0.3, -1.5]` | `[-29.1, -0.5, -1.65]` | `70` |
| `aisle_reveal` | `[4.0724, 0.5425, -1.476]` | `[-29.1, -0.5, -1.65]` | `70` |
| `aisle_walk_mid` | `[-0.65, 0.25, -0.95]` | `[-29.1, -0.5, -1.6]` | `70` |
| `altar_approach` | `[-7.2, 0.85, -0.6]` | `[-4, -0.4, -3]` | `40` |
| `lectern_end_point` | `[-12.85, 7.85, -2]` | `[-2.8, -2.35, -1.9]` | `34` |
| `bible_closeup` | `[-12.85, 7.85, -2]` | `[-2.8, -2.35, -1.9]` | `34` |
| `bible_open_pages` | `[-12.85, 7.85, -2]` | `[-2.8, -2.35, -1.9]` | `34` |

## Altar Rig

The approved lectern and Bible move together as one altar rig:

```js
altar: {
  position: [-5.45, -1.05, -1.6],
  rotation: [0, 269, 0],
  scale: 0.64
}
```

## Gate Entry

The public homepage now starts with the real optimized wooden church door model before the church interior is revealed:

```js
gateDoor: {
  position: [1.2, -1.05, -1.48],
  rotation: [0, 90, 0],
  targetHeight: 3.9,
  fadeStart: 0.08,
  fadeEnd: 0.2,
  churchRevealStart: 0.08,
  churchRevealEnd: 0.18
}
```

## Church Framing

```js
church: {
  position: [0, -0.2, 0],
  rotation: [0, 0, 0],
  scale: 0.82,
  visible: true
}

environment: {
  fog: 0.038,
  darkness: 0.42,
  crop: {
    left: -8,
    right: 8,
    near: -8,
    far: 6
  }
}
```

The church model is a single merged scan mesh, so the approved public approach is camera framing, fog, darkness, and the door-first reveal rather than deleting individual rooms. The homepage does not use clipping planes, which keeps the central altar and stained-glass window material visible.

## Approved Book Transform

```js
book: {
  position: [-0.33, 2.02, -0.12],
  rotation: [18, 0, 360],
  scale: 0.26
}
```

The cover decal remains attached to `cover-l_36` on the `back / underside` face.

## Opening Timing

```js
opening: {
  clipTimeRatio: 0.5,
  scrollStart: 0.82,
  scrollEnd: 0.98
}
```

The homepage drives the animated book with the same locked timing but keeps the action active while scrubbing, so the book opens in place instead of the page overlay appearing over a static closed cover.

## Scroll Smoothing

The public sequence uses requestAnimationFrame damping rather than direct scroll-to-camera jumps:

```js
smoothing: {
  cameraDamping: 3.2,
  targetDamping: 3.8,
  fovDamping: 4.5,
  animationDamping: 3.2,
  scrollDamping: 6
}
```

## Lighting / Rendering

The homepage reads these values from `APPROVED_SEQUENCE_CONFIG.lighting`:

```js
lighting: {
  toneMappingExposure: 1.05,
  fog: {
    color: '#090403',
    desktopDensity: 0.038,
    mobileDensity: 0.065
  },
  hemisphere: {
    skyColor: '#fff0cc',
    groundColor: '#160604',
    intensity: 1.15
  },
  key: {
    color: '#ffd18a',
    intensity: 2.8,
    position: [-3.2, 5.2, 4.6]
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
    target: [0, 1.8, 0]
  }
}
```

## Sequence Lab Export Button

`/sequence-lab` includes a visible button:

`Copy approved config for homepage`

It reads the current lab state, including any saved `localStorage` tuning, then copies a source-ready `APPROVED_SEQUENCE_CONFIG` export to the clipboard and prints it to the browser console.
