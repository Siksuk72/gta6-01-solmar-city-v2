// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html, its ES
// modules and a vendored three.js build, no network request), and the program hands it in.
// It copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// The game is Solmar City v2: a complete open-world crime game — a sun-soaked coastal city to
// explore on foot and by car, traffic and pedestrians, cars to steal, a wanted level with police
// chases and the AIR-1 helicopter, eight story missions with a talking crew, combat with five
// weapons, three synthesized radio stations, shops, a safehouse, garage upgrades and NOS,
// side activities, a dense HUD with a district minimap, a start screen and localStorage saves,
// all with synthesized sound and music. Serve it locally with
// `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail fast with a readable error instead of copying half an entry when
// the game folder (or the screenshots) is missing from beside this file.
if (!existsSync(join(here, 'game'))) throw new Error(`game/ not found beside ${here} — nothing to hand in`);
if (!existsSync(join(here, 'game', 'index.html'))) throw new Error(`game/index.html not found beside ${here} — the entry has no page to open`);
if (!existsSync(join(here, 'screenshots'))) throw new Error(`screenshots/ not found beside ${here} — the entry needs its 4 shots`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
