// Glimmerdeep: bootstrap, the main loop, and the screen state machine (menu, play, pause,
// win, lose). The world owns the rules; this file only wires input, sound and drawing to it.
// Open with ?shot=menu|play|end to stage one screenshot scene instead of playing.

import { BEST_KEY, FIELD, STEP } from './config.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { World, EVENT_LOSE, EVENT_WIN } from './world.js';
import { render, SCREEN_LOSE, SCREEN_MENU, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sounds = new SoundBank();
const world = new World(20261116);

let screen = SCREEN_MENU;
let best = loadBest();
let lastTime = performance.now();
let accumulator = 0;
let announced = '';

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

function startRun() {
  sounds.unlock();
  world.reset();
  screen = SCREEN_PLAY;
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
    announce(`You lit the reef! Final score ${world.state.score}. Press R to dive again.`);
  } else {
    sounds.lose();
    announce(`The light went out. Final score ${world.state.score}. Press R to dive again.`);
  }
}

function fitCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const scale = Math.min(width / FIELD.width, height / FIELD.height);
  const offsetX = (width - FIELD.width * scale) / 2;
  const offsetY = (height - FIELD.height * scale) / 2;
  input.setViewport(scale, offsetX, offsetY);
  ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
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
  if (events.levelUp) sounds.levelUp();
  if (events.hit) sounds.hit();
  if (events.over === EVENT_WIN) endRun(true);
  if (events.over === EVENT_LOSE) endRun(false);
}

function frame(now) {
  const elapsed = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += elapsed;

  if (input.takePressed('KeyM')) {
    const muted = sounds.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  if (screen === SCREEN_MENU) handleMenuKeys();
  if (screen === SCREEN_WIN || screen === SCREEN_LOSE) handleEndKeys();
  if (screen === SCREEN_PLAY && input.takePressed('KeyP')) {
    screen = SCREEN_PAUSE;
    announce('Paused. Press P to keep diving.');
  } else if (screen === SCREEN_PAUSE && input.takePressed('KeyP')) {
    screen = SCREEN_PLAY;
    announce('Diving.');
  }

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

  render(ctx, world.state, screen, { best, muted: sounds.muted, now: now / 1000 });
  requestAnimationFrame(frame);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

const shot = new URLSearchParams(window.location.search).get('shot');
if (shot !== null) {
  // A staged scene for screenshots: play the real rules forward, then draw one frame.
  // `t` stretches the play scene, for a later-game frame; the time is picked so the
  // blinking prompts on the menu and end screens are showing in the still.
  const params = new URLSearchParams(window.location.search);
  const seconds = Number(params.get('t'));
  const staged = stageShot(shot, world, Number.isFinite(seconds) && seconds > 0 ? seconds : null);
  screen = staged.screen;
  best = staged.best;
  render(ctx, world.state, screen, { best, muted: false, now: 6.4 });
} else {
  announce('Glimmerdeep. Press Enter or click to dive.');
  requestAnimationFrame(frame);
}
