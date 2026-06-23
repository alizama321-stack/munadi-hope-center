# Munadi Hope Center

Cinematic website prototype for Munadi Hope Center.

Phase 1 is complete: the project now has organized asset folders, protected original GLB files, optimized GLB outputs, and documentation for the next build phase.

Phase 2 is complete: the prototype now uses one persistent Three.js canvas for a continuous scroll-controlled scene-blocking pass.

## Project Structure

```text
public/
  assets/
    models/
      original/    Source GLB files, kept untouched.
      optimized/   Web-optimized GLB files for Phase 2.
    textures/      Texture staging area for future custom leather, paper, and gold assets.
src/               Existing prototype source files.
docs/              Planning and audit documentation.
```

## Setup

Install local tooling:

```bash
pnpm install
```

Run the current static prototype from the project root:

```bash
python -m http.server 5173
```

Then open:

```text
http://127.0.0.1:5173/
```

## Asset Strategy

- Keep original assets in `public/assets/models/original/`.
- Use `public/assets/models/optimized/` for web delivery.
- Do not embed massive base64 assets in HTML.
- Use `biblia.glb` as the closed Bible.
- Use `open_bible.glb` as the opened Bible.
- Use `lectern.glb` as the stage anchor.
- Use the church door and interior as desktop-only environment assets unless lighter fallbacks are created.

The optimized GLBs use meshopt compression and WebP textures. The future Three.js loader must include `MeshoptDecoder`.

## Performance Strategy

- Load the hero shell and HTML content first.
- Lazy-load 3D models after the first meaningful paint.
- Gate heavy environment assets by device capability and viewport size.
- Use static fallbacks for mobile and reduced-motion users.
- Avoid long pinned scroll traps on phones.
- Keep real text as HTML, not as texture-only content.

## Phase 2 Scene Blocking

Current flow:

1. Camera starts at the wooden church door.
2. Camera moves through the entrance into the church aisle.
3. Camera approaches the lectern.
4. Hero text appears as HTML on the left while the lectern and closed Bible sit in the 3D scene.
5. Camera pushes closer to the Bible.
6. Closed Bible fades into the open Bible.
7. The open Bible becomes the visual foundation for the next readable content layer.

Implementation notes:

- The canvas is fixed and persistent across the page, not boxed inside the hero.
- Models are loaded from `public/assets/models/optimized/`.
- The optimized files use meshopt compression, so the loader uses `MeshoptDecoder`.
- Camera timeline points are named and commented in `src/main.js` for tuning.
- Add `?debug=1` to the URL to show timeline percentage and scene beat labels.
- Mobile skips the heavy church interior asset and uses a shorter/lighter environment path.
- Important text stays in HTML overlays for accessibility and readability.

Known Phase 2 limitations:

- This is scene blocking only, not final cinematic polish.
- The open Bible placement is intentionally rough and should be art-directed in Phase 3.
- The unlit door/interior materials still need lighting/material treatment.
- Pastor, Prayer Request, Visit, and final CTA sections are placeholders only.

## Model Optimization

The local optimizer is installed with:

```bash
pnpm add -D @gltf-transform/cli sharp
```

Regenerate optimized models:

```bash
pnpm run optimize:models
```

See the full model report:

```text
docs/asset-audit.md
```

## Next Implementation Phases

1. Art-direct the church lighting, shadows, fog, and material treatment.
2. Tune the open Bible placement so the page spread becomes a calm readable surface.
3. Design the Pastor, Prayer Request, Visit, and final CTA chapter overlays.
4. Add static image fallbacks for reduced-motion and low-power mobile devices.
5. Polish the full scroll choreography after the content chapters are approved.

## GitHub Target

Planned private repository:

```text
alizama321-stack/munadi-hope-center
```
