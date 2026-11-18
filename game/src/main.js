// Solmar City — entry point. Boots the game, shows the title screen, and
// stages the named screenshot scene when the page is opened with ?shot=.
import { Game } from './world.js';
import { MISSIONS } from './config.js';
import { loadSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  stageShot(game, shotName);
  window.__shotReady = false;
  let frames = 0;
  const waitFrames = () => {
    frames += 1;
    if (frames >= 60) window.__shotReady = true;
    else requestAnimationFrame(waitFrames);
  };
  requestAnimationFrame(waitFrames);
} else {
  const save = loadSave();
  game.hud.showTitle(!!save, MISSIONS, save ? (save.missionIndex ?? 0) : 0);
}

game.run();

// Debug handle for smoke tests and the console: window.__solmar exposes the
// live game (state, player, wanted) without touching the save or the UI.
window.__solmar = game;
