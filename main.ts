// Vice Ledger — hand-in program for the make.fun gta6-trophy-guide-01 bounty.
//
// The guide itself is the static site under app/ (open app/index.html in a
// browser; it needs no build step and no network). This program is what
// hands the entry in: it copies app/ and screenshots/ into the output
// directory and writes dossier.json there with buildDossier from the
// vendored library in vendor/makefun-frontend.ts. That library file is the
// kit's own copy and stays untouched — the scorer rebuilds the dossier
// with its copy and compares the two byte for byte.
//
// Run it the way the grader does, or locally with an output override:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps for this bounty, passed to the library so an entry the
// scorer would refuse is refused here first: dossier text at most
// 163,840 bytes, at most 4 screenshots of at most 256 KiB each, app/ at
// most 993 files and directories and 48 MiB in all.
const GATE_LIMITS = {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  app_max_files: 993,
  app_max_bytes: 50_331_648,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
} else {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE_LIMITS));
