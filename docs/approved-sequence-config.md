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
| `gate_entry` | `[0, 1.95, 7.25]` | `[0, 2.1, 2.8]` | `50` |
| `aisle_reveal` | `[0, 1.85, 4.65]` | `[0, 2.55, -3]` | `62` |
| `aisle_walk_mid` | `[0, 1.88, 2.05]` | `[0, 2.35, -3.25]` | `48` |
| `altar_approach` | `[0, 2.02, -0.75]` | `[0, 2.18, -3.5]` | `36` |
| `lectern_end_point` | `[0, 2.18, -2]` | `[0, 2.16, -3.55]` | `30` |
| `bible_closeup` | `[-0.12, 3.08, -3.04]` | `[0, 2.26, -3.55]` | `22` |
| `bible_open_pages` | `[0, 3.18, -3.5]` | `[0, 2.18, -3.55]` | `24` |

## Altar Rig

The approved lectern and Bible move together as one altar rig:

```js
altar: {
  position: [0, 0, -3.55],
  rotation: [0, 180, 0],
  scale: 1
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

The church model is a single merged scan mesh, so the approved approach is camera framing, fog, darkness, crop planes, and viewport masking rather than deleting individual rooms.

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
