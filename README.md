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

## Approved Homepage Sequence

- The public homepage uses `APPROVED_SEQUENCE_CONFIG` from `src/approved-sequence-config.js`.
- `/sequence-lab` is an archived calibration tool only. It may use `localStorage` for tuning, but the homepage must not depend on Sequence Lab `localStorage`.
- When Sequence Lab values are approved, copy them into `src/approved-sequence-config.js`, then commit and push.
- The visible Sequence Lab button `Copy approved config for homepage` copies a source-ready config object and prints it to the browser console.
- Public homepage requirements: no sliders, no helper grids, no calibration panels, no debug labels, and no artificial floor/base platform.

Current flow:

1. Camera starts at the wooden church door.
2. Camera passes the threshold and follows the center nave direction.
3. Camera moves down the central aisle/hallway toward the stage.
4. Camera approaches the lectern.
5. Hero text appears as HTML on the left while the lectern and closed Bible sit in the 3D scene.
6. Camera pushes closer to the closed Bible.
7. Camera reaches a top-down Bible cover view.
8. Closed Bible transitions to the open Bible from the same mount position.
9. Readable HTML test content appears over the left and right Bible page areas.

Corrected camera waypoints:

```text
entrance_pov
aisle_start
aisle_mid
stage_approach
lectern_stage
bible_cover_topdown
bible_open_on_lectern
bible_pages_content
```

Model-orientation notes:

- The church interior GLB's longest nave direction is its local X axis.
- Phase 2 rotates that local X axis onto the world Z travel path so the camera moves through the center instead of drifting through random side fragments.
- The interior scan is treated as atmospheric architecture and faded before the lectern beat because the source model contains broken scan edges.
- The wooden door model is a closed entrance, so it fades after the threshold beat to simulate passing through the doorway.

Implementation notes:

- The canvas is fixed and persistent across the page, not boxed inside the hero.
- Models are loaded from `public/assets/models/optimized/`.
- The optimized files use meshopt compression, so the loader uses `MeshoptDecoder`.
- Camera timeline points are named and commented in `src/main.js` for tuning.
- `src/main.js` now uses a `LecternSurface` anchor and a child `BibleRig` so the closed and open Bible share the same physical anchor on the lectern.
- The Bible GLBs are normalized with bounding-box inspection so width runs left/right, length runs front/back, and thickness runs up/down before local correction constants are applied.
- Editable tuning constants include `lecternSurfacePosition`, `lecternSurfaceRotation`, `bibleRigPosition`, `bibleRigRotation`, `bibleRigScale`, `closedBibleLocalRotation`, `closedBibleLocalOffset`, `closedBibleScale`, `openBibleLocalRotation`, `openBibleLocalOffset`, and `openBibleScale`.
- The opening beat uses a procedural hinged cover and fluttering page planes before fading to the open Bible model in the same `BibleRig` position.
- Public navigation no longer exposes prototype labels; debug labels, the lectern surface helper grid, and calibration controls are hidden unless `?debug=1` is active.
- Add `?debug=1` to the URL to show timeline percentage, scene beat labels, lectern surface grid, and the live BibleRig calibration panel. Press `P` or click `Print transforms` to log values to the console.
- Mobile skips the heavy church interior asset and uses a shorter/lighter environment path.
- Important text stays in HTML overlays for accessibility and readability.

Known Phase 2 limitations:

- This is scene blocking only, not final cinematic polish.
- The open Bible/page overlay placement is still a test layer and should be art-directed in the next approved phase.
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
