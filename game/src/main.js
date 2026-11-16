// Glimmerdeep 3D: bootstrap, the main loop, and the screen state machine (menu, play,
// pause, win, lose). The world owns the rules; this file only wires input, sound, the
// 3D renderer and the DOM HUD to it.
// Open with ?shot=menu|play|deep|abyss|win|end to stage one screenshot scene instead
// of playing. ?shot=play&t=26 stages a mid-game frame; deep/abyss/win fast-forward the
// autopilot until the run reaches that zone or wins.

import { BEST_KEY, DASH, PEARLS_TO_WIN, STEP, ZONES } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World, EVENT_LOSE, EVENT_WIN } from './world.js';
import { Renderer3D, SCREEN_LOSE, SCREEN_MENU, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_WIN } from './render3d.js';
import { stageShot } from './shots.js';

const app = document.getElementById('app');
const statusLine = document.getElementById('status');
const hud = {
  score: document.getElementById('hud-score'),
  pearls: document.getElementById('hud-pearls'),
  light: document.getElementById('lightbar'),
  lives: document.getElementById('hud-lives'),
  combo: document.getElementById('hud-combo'),
  zone: document.getElementById('hud-zone'),
  dash: document.getElementById('dashbar'),
  best: document.getElementById('hud-best'),
  banner: document.getElementById('banner'),
  mute: document.getElementById('btn-mute'),
  pause: document.getElementById('btn-pause'),
};
const overlays = {
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause'),
  win: document.getElementById('win'),
  lose: document.getElementById('lose'),
};
const winText = document.getElementById('win-text');
const loseText = document.getElementById('lose-text');

const renderer = new Renderer3D(app);
const input = new Input(renderer.renderer.domElement);
const sounds = new SoundBank();
const world = new World(20261116);

// A tiny handle for live testing (headless play-tests read the state through it).
window.__glimmerdeep = {
  world,
  get screen() { return screen; },
  get best() { return best; },
};

let screen = SCREEN_MENU;
let best = loadBest();
let lastTime = performance.now();
let accumulator = 0;
let announced = '';
let bannerTimer = null;
let lastHud = '';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // A browser that refuses storage still plays fine.
  }
}

function announce(text) {
  if (text === announced) return;
  announced = text;
  statusLine.textContent = text;
}

function showBanner(text) {
  hud.banner.textContent = text;
  hud.banner.style.opacity = '1';
  if (bannerTimer !== null) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    hud.banner.style.opacity = '0';
  }, 1800);
}

function showOverlay(name) {
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle('hidden', key !== name);
  }
}

function updateHud() {
  const s = world.state;
  const tier = world.comboTier();
  const key = [
    s.score, s.pearlsCollected, Math.round(s.light), s.lives,
    tier, s.zone, Math.round(s.dashCooldown * 10), best,
    screen, sounds.muted,
  ].join('|');
  if (key === lastHud) return;
  lastHud = key;
  hud.score.textContent = String(s.score);
  hud.pearls.textContent = `${s.pearlsCollected}/${PEARLS_TO_WIN}`;
  hud.light.style.width = `${Math.max(0, Math.min(100, s.light))}%`;
  hud.lives.textContent = '\u2764'.repeat(Math.max(0, s.lives)) + '\u00B7'.repeat(Math.max(0, 5 - s.lives));
  hud.combo.textContent = tier > 1 ? `Combo x${tier}` : '';
  hud.zone.textContent = ZONES[s.zone].name;
  hud.dash.style.width = s.dashCooldown <= 0 ? '100%' : `${Math.round((1 - s.dashCooldown / DASH.cooldown) * 100)}%`;
  hud.best.textContent = `Best ${best}`;
  hud.mute.textContent = sounds.muted ? 'Sound: off' : 'Sound: on';
}

function startRun() {
  sounds.unlock();
  world.reset();
  renderer.clearWorld();
  screen = SCREEN_PLAY;
  showOverlay(null);
  announce('Diving. Gather 30 pearls. Watch your light.');
}

function endRun(won) {
  screen = won ? SCREEN_WIN : SCREEN_LOSE;
  if (world.state.score > best) {
    best = world.state.score;
    saveBest();
  }
  if (won) {
    sounds.win();
    winText.textContent = `The Heart of the Deep is yours. Final score ${world.state.score} — best ${best}.`;
    showOverlay('win');
    announce(`You lit the reef! Final score ${world.state.score}. Press R to dive again.`);
  } else {
    sounds.lose();
    loseText.textContent = `Pearls ${world.state.pearlsCollected} of ${PEARLS_TO_WIN} — final score ${world.state.score}, best ${best}.`;
    showOverlay('lose');
    announce(`The light went out. Final score ${world.state.score}. Press R to dive again.`);
  }
}

function toggleMute() {
  const muted = sounds.toggleMute();
  announce(muted ? 'Sound off.' : 'Sound on.');
  lastHud = '';
  updateHud();
}

function togglePause() {
  if (screen === SCREEN_PLAY) {
    screen = SCREEN_PAUSE;
    showOverlay('pause');
    announce('Paused. Press P to keep diving.');
  } else if (screen === SCREEN_PAUSE) {
    screen = SCREEN_PLAY;
    showOverlay(null);
    announce('Diving.');
  }
}

function handleMenuKeys() {
  if (input.takePressed('Enter') || input.takePressed('Space') || input.takePressed('Pointer')) startRun();
}

function handleEndKeys() {
  if (input.takePressed('KeyR') || input.takePressed('Enter') || input.takePressed('Space') || input.takePressed('Pointer')) startRun();
}

function stepGame() {
  const events = world.step(STEP, input.steering());
  if (events.pearlTier > 0) sounds.pickup(events.pearlTier);
  if (events.orb) sounds.orb();
  if (events.golden) showBanner('Golden pearl! +light');
  if (events.heart) showBanner('+1 life!');
  if (events.dash) sounds.dash();
  if (events.levelUp) {
    sounds.levelUp();
    showBanner(`Level ${world.state.level}`);
  }
  if (events.zoneUp) {
    sounds.levelUp();
    showBanner(ZONES[world.state.zone].name);
  }
  if (events.hit) sounds.hit();
  if (events.over === EVENT_WIN) endRun(true);
  if (events.over === EVENT_LOSE) endRun(false);
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += elapsed;

  if (input.takePressed('KeyM')) toggleMute();
  if (input.takePressed('KeyP')) togglePause();

  if (screen === SCREEN_MENU) handleMenuKeys();
  if (screen === SCREEN_WIN || screen === SCREEN_LOSE) handleEndKeys();

  if (screen === SCREEN_PLAY) {
    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      stepGame();
      accumulator -= STEP;
      guard += 1;
      if (screen !== SCREEN_PLAY) break;
    }
    if (guard === 5) accumulator = 0;
  } else {
    accumulator = 0;
  }
  input.endStep();

  updateHud();
  renderer.render(world.state, screen, { best, muted: sounds.muted, now: now / 1000 });
  requestAnimationFrame(frame);
}

hud.mute.addEventListener('click', () => {
  sounds.unlock();
  toggleMute();
});
hud.pause.addEventListener('click', () => togglePause());
window.addEventListener('resize', () => {
  renderer.resize();
  input.setViewport(1, 0, 0);
});
// The pointer steers in logical field coordinates: the 3D view covers the whole field,
// so map the canvas pixel position onto the 1280x720 field.
input.setViewport(
  Math.min(window.innerWidth / 1280, window.innerHeight / 720),
  (window.innerWidth - 1280 * Math.min(window.innerWidth / 1280, window.innerHeight / 720)) / 2,
  (window.innerHeight - 720 * Math.min(window.innerWidth / 1280, window.innerHeight / 720)) / 2,
);

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot !== null) {
  // A staged scene for screenshots: play the real rules forward, then draw one frame.
  const seconds = Number(params.get('t'));
  const staged = stageShot(shot, world, Number.isFinite(seconds) && seconds > 0 ? seconds : null);
  screen = staged.screen;
  best = staged.best;
  if (screen === SCREEN_WIN) {
    winText.textContent = `The Heart of the Deep is yours. Final score ${world.state.score} — best ${best}.`;
    showOverlay('win');
  } else if (screen === SCREEN_LOSE) {
    loseText.textContent = `Pearls ${world.state.pearlsCollected} of ${PEARLS_TO_WIN} — final score ${world.state.score}, best ${best}.`;
    showOverlay('lose');
  } else {
    showOverlay(screen === SCREEN_MENU ? 'menu' : null);
  }
  updateHud();
  renderer.render(world.state, screen, { best, muted: false, now: 6.4 });
  document.title = `Glimmerdeep 3D — ${shot}`;
} else {
  showOverlay('menu');
  announce('Glimmerdeep. Press Enter or click to dive.');
  requestAnimationFrame(frame);
}
