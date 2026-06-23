# Munadi Hope Center Asset Audit

Phase 1 created a protected source folder for the original models and an optimized folder for web-ready experiments.

- Originals: `public/assets/models/original/`
- Optimized: `public/assets/models/optimized/`
- Texture staging: `public/assets/textures/`

The original files were copied into `original/` before cleanup. The older duplicate copies at `public/assets/models/*.glb` were removed after confirming the protected originals exist and the current source does not reference the old root-level paths.

## Optimization Pass

Tooling installed locally:

- `@gltf-transform/cli` 4.4.0
- `sharp` 0.35.2

Optimization command pattern:

```bash
gltf-transform optimize input.glb output.glb --compress meshopt --meshopt-level high --texture-compress webp --texture-size 2048
```

Notes:

- Optimized files use `EXT_meshopt_compression`, `KHR_mesh_quantization`, and `EXT_texture_webp`.
- The future Three.js / React Three Fiber loader must include `MeshoptDecoder`.
- WebP textures are good for delivery size, but the implementation should keep reduced-motion and mobile fallbacks available.

## Model Summary

| Asset | Intended role | Original size | Optimized size | Triangles original | Triangles optimized | Desktop use | Mobile fallback |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| `biblia.glb` | Closed Bible on lectern | 11.50 MB | 1.31 MB | 116 | 116 | Safe | Safe, but consider static image on very low-end phones |
| `open_bible.glb` | Open Bible / page reveal | 10.68 MB | 0.94 MB | 123,118 | 27,692 | Safe | Use shortened sequence or static opened-book image |
| `lectern.glb` | Stage / altar support | 29.38 MB | 0.96 MB | 12,048 | 10,788 | Safe | Safe if loaded after hero shell |
| `wooden_church_door.glb` | Entrance shot | 11.19 MB | 1.07 MB | 184,580 | 183,024 | Usable with care | Needs simplified fallback or static entrance image |
| `st_bartholomew-the-less_interior.glb` | Full church interior | 57.57 MB | 5.53 MB | 1,621,108 | 1,123,114 | Heavy but possible on desktop only | Needs fallback; do not load on mobile by default |

## Asset Notes

### `biblia.glb`

- Best choice for the closed Bible.
- Geometry is very light; the original weight came almost entirely from three embedded 2048px textures.
- Optimization reduced it from 11.50 MB to 1.31 MB through WebP texture conversion and meshopt compression.
- Safe for desktop and most mobile devices.

### `open_bible.glb`

- Best choice for the open Bible.
- Has meaningful Bible details: hard cover, leather material, gold page treatment, bookmark, and text-page meshes.
- Optimization reduced geometry from 123,118 to 27,692 triangles and file size from 10.68 MB to 0.94 MB.
- Texture coordinates triggered optimizer warnings because some UVs sit outside the normal 0-1 range. This is not automatically fatal, but the model needs visual QA after loading.
- Safe for desktop. For mobile, use a short transition or static fallback.

### `lectern.glb`

- Good stage object for the camera approach toward the Bible.
- Original was texture-heavy: three 4096px PNG textures were responsible for almost all of the 29.38 MB file.
- Optimization reduced it to 0.96 MB.
- Safe for desktop and likely usable on mobile if lazy-loaded.

### `wooden_church_door.glb`

- Useful for the opening entrance moment.
- Geometry remains high after optimization: 183,024 triangles.
- Uses `KHR_materials_unlit`, so it may not respond naturally to cinematic lighting without material overrides.
- Safe for desktop if used briefly. Mobile should get a simplified model, static image, or skipped entrance shot.

### `st_bartholomew-the-less_interior.glb`

- Strong candidate for a real church environment, but still the riskiest asset.
- Even optimized, it has 1,123,114 triangles and is 5.53 MB.
- Uses `KHR_materials_unlit`, so it may look flat unless materials are adapted in Phase 2.
- Desktop only unless a much lighter environment is created. Mobile should use a still image, blurred backdrop, or simplified set.

## Recommended Use In The Cinematic Journey

1. Entrance: `wooden_church_door.glb` on desktop; static fallback on mobile.
2. Interior: `st_bartholomew-the-less_interior.glb` only on desktop after capability checks.
3. Stage: `lectern.glb` as the stable anchor on the right side of the hero.
4. Closed sacred object: `biblia.glb` placed on the lectern.
5. Reveal: cross-fade or scroll-transition from `biblia.glb` to `open_bible.glb`.
6. Content chapters: readable HTML overlays aligned to the open-book spread, not baked into textures.

## Open QA Before Phase 2

- Visually inspect every optimized model in-browser.
- Confirm WebP texture support on target browsers.
- Add `MeshoptDecoder` to the model loader.
- Check whether unlit door/interior materials need replacement for warmer, more realistic lighting.
- Create mobile stills or simplified fallbacks before connecting the full scroll journey.
