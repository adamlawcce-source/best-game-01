// Glimmerdeep's hand-in program (Node 22, standard library only). The game itself is the
// plain static files in this directory's game/ folder — a desktop browser loads them offline
// (game/index.html and its ES modules, Three.js r186 vendored under game/vendor/three/,
// no network request) — and this program
// hands them in: it copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there, the summary the judge reads, using the vendored
// make.fun library. Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root, worked out from this file's own location.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer caps the whole output, so the program refuses early rather than handing in
// something the gate would refuse: at most 4 screenshots, each at most 256 KiB; game/ at
// most 993 files and 48 MiB in all, no path under it over 1000 bytes.
const dossierLimits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  // A stale run's files must not leak into this one: clear what a previous run left.
  for (const name of ['game', 'screenshots', 'dossier.json']) {
    const target = join(outputDir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
  } else {
    mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(outputDir, dossierLimits);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
