# Munadi Hope Center

Cinematic website prototype for Munadi Hope Center.

Phase 1 is complete: the project now has organized asset folders, protected original GLB files, optimized GLB outputs, and documentation for the next build phase.

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

1. Build a full-page 3D scene shell that can span the whole scroll journey.
2. Add camera path sections: door, church interior, lectern, closed Bible, open Bible.
3. Connect the scroll timeline while keeping all important text readable as HTML.
4. Replace or adapt unlit model materials so lighting feels warm, sacred, and cinematic.
5. Add mobile and reduced-motion fallbacks before polishing the final choreography.

## GitHub Target

Planned private repository:

```text
alizama321-stack/munadi-hope-center
```
