import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const originalModelsPath = resolve(process.cwd(), 'dist/assets/models/original');

await rm(originalModelsPath, { recursive: true, force: true });

