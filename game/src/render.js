// Everything the player sees, drawn on one canvas: the reef, the fish, the hunters, the
// light that keeps the run alive, the HUD, and the menu and end screens. Drawing never
// changes the world; it only reads the state handed to it.

import { FIELD, LIGHT_START, PALETTE, PEARLS_TO_WIN } from './config.js';

export const SCREEN_MENU = 'menu';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawBackground(ctx, state, now) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.deepTop);
  gradient.addColorStop(0.55, PALETTE.deepMid);
  gradient.addColorStop(1, PALETTE.deepBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Slow shafts of light from the surface.
  ctx.save();
  ctx.fillStyle = PALETTE.ray;
  for (let i = 0; i < 5; i += 1) {
    const x = 180 + i * 240 + Math.sin(now * 0.12 + i * 1.7) * 26;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 70, 0);
    ctx.lineTo(x + 190, FIELD.height);
    ctx.lineTo(x + 60, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Drifting plankton motes.
  ctx.fillStyle = 'rgba(190, 235, 255, 0.5)';
  for (const mote of state.plankton) {
    const y = mote.y + Math.sin(now * 0.5 + mote.phase) * 8;
    ctx.beginPath();
    ctx.arc(mote.x, y, mote.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWeeds(ctx, state, now);

  // The sandy floor.
  ctx.fillStyle = PALETTE.sand;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height - 34);
  ctx.quadraticCurveTo(FIELD.width * 0.3, FIELD.height - 52, FIELD.width * 0.55, FIELD.height - 30);
  ctx.quadraticCurveTo(FIELD.width * 0.8, FIELD.height - 14, FIELD.width, FIELD.height - 38);
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.lineTo(0, FIELD.height);
  ctx.closePath();
  ctx.fill();
}

function drawWeeds(ctx, state, now) {
  for (const weed of state.weeds) {
    const sway = Math.sin(now * 0.8 + weed.phase) * 14;
    const tipX = weed.x + sway + weed.lean * weed.height;
    const baseY = FIELD.height - 26;
    ctx.strokeStyle = PALETTE.weed;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(weed.x, baseY);
    ctx.quadraticCurveTo(weed.x + sway * 0.4, baseY - weed.height * 0.6, tipX, baseY - weed.height);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.weedTip;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(weed.x, baseY);
    ctx.quadraticCurveTo(weed.x + sway * 0.4, baseY - weed.height * 0.6, tipX, baseY - weed.height);
    ctx.stroke();
  }
}

function glowCircle(ctx, x, y, radius, colour, core) {
  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPearls(ctx, state, now) {
  for (const pearl of state.pearls) {
    const y = pearl.y + Math.sin(pearl.phase) * pearl.bob * 0.4;
    glowCircle(ctx, pearl.x, y, pearl.radius, PALETTE.pearl, PALETTE.pearlCore);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(pearl.x - 4, y - 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const orb of state.orbs) {
    const y = orb.y + Math.sin(orb.phase) * orb.bob * 0.4;
    const pulse = 1 + Math.sin(now * 5 + orb.phase) * 0.12;
    glowCircle(ctx, orb.x, y, orb.radius * pulse, PALETTE.orb, PALETTE.orbCore);
  }
}

function drawAnglers(ctx, state) {
  for (const angler of state.anglers) {
    const facing = angler.direction;
    ctx.save();
    ctx.translate(angler.x, angler.y);
    ctx.scale(facing, 1);
    // Tail fin.
    ctx.fillStyle = PALETTE.anglerBelly;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-48, -14);
    ctx.lineTo(-48, 14);
    ctx.closePath();
    ctx.fill();
    // Body.
    ctx.fillStyle = PALETTE.angler;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly.
    ctx.fillStyle = PALETTE.anglerBelly;
    ctx.beginPath();
    ctx.ellipse(2, 10, 26, 12, 0, 0, Math.PI);
    ctx.fill();
    // Jaw with teeth.
    ctx.fillStyle = '#2a0e1e';
    ctx.beginPath();
    ctx.moveTo(18, -4);
    ctx.quadraticCurveTo(38, 6, 20, 16);
    ctx.quadraticCurveTo(28, 4, 18, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.anglerTeeth;
    for (let i = 0; i < 4; i += 1) {
      const tx = 22 + i * 4;
      ctx.beginPath();
      ctx.moveTo(tx, 2 + (i % 2) * 2);
      ctx.lineTo(tx + 3, 2 + (i % 2) * 2);
      ctx.lineTo(tx + 1.5, 9);
      ctx.closePath();
      ctx.fill();
    }
    // Eye and glowing lure.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(16, -10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0a12';
    ctx.beginPath();
    ctx.arc(17, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a1526';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -20);
    ctx.quadraticCurveTo(20, -38, 30, -34);
    ctx.stroke();
    glowCircle(ctx, 30, -34, 6, PALETTE.anglerGlow, '#ffd7e6');
    ctx.restore();
  }
}

function drawPlayer(ctx, state, now) {
  const p = state.player;
  if (p.invulnerable > 0 && Math.floor(now * 14) % 2 === 0) return; // blink while hurt
  const wag = Math.sin(p.wiggle) * 0.35;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.face, 1);
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 26;
  // Tail.
  ctx.fillStyle = '#e8a93d';
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(-44, -13 - wag * 14);
  ctx.lineTo(-44, 13 + wag * 14);
  ctx.closePath();
  ctx.fill();
  // Body.
  const body = ctx.createLinearGradient(0, -20, 0, 20);
  body.addColorStop(0, PALETTE.player);
  body.addColorStop(1, '#e8a93d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Belly.
  ctx.fillStyle = PALETTE.playerBelly;
  ctx.beginPath();
  ctx.ellipse(2, 9, 20, 8, 0, 0, Math.PI);
  ctx.fill();
  // Dorsal fin.
  ctx.fillStyle = '#e8a93d';
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.quadraticCurveTo(4, -30, 14, -15);
  ctx.closePath();
  ctx.fill();
  // Eye.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(14, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#12222e';
  ctx.beginPath();
  ctx.arc(16, -6, 3, 0, Math.PI * 2);
  ctx.fill();
  // Lure stalk with its lamp.
  ctx.strokeStyle = '#8a6a1f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, -16);
  ctx.quadraticCurveTo(24, -30, 34, -26);
  ctx.stroke();
  glowCircle(ctx, 35, -26, 6, PALETTE.lure, '#fffbe0');
  ctx.restore();
}

function drawBubbles(ctx, state) {
  ctx.strokeStyle = PALETTE.bubble;
  ctx.lineWidth = 1.5;
  for (const bubble of state.bubbles) {
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles(ctx, state) {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.colour;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloats(ctx, state) {
  ctx.textAlign = 'center';
  ctx.font = '700 20px system-ui, sans-serif';
  for (const text of state.floats) {
    ctx.globalAlpha = Math.min(1, text.life);
    ctx.fillStyle = text.colour;
    // Keep the text inside the frame: a level-up callout at the edge reads as a glitch.
    const x = Math.max(80, Math.min(FIELD.width - 80, text.x));
    ctx.fillText(text.text, x, text.y);
  }
  ctx.globalAlpha = 1;
}

/** The dark water closes in as the lamp drains: a hole of light follows the fish. */
function drawDarkness(ctx, state) {
  const light = state.light / LIGHT_START;
  const radius = 120 + light * 320;
  const p = state.player;
  const gradient = ctx.createRadialGradient(p.x, p.y, radius * 0.25, p.x, p.y, radius);
  gradient.addColorStop(0, 'rgba(2, 10, 20, 0)');
  gradient.addColorStop(0.75, 'rgba(2, 10, 20, 0.18)');
  gradient.addColorStop(1, 'rgba(2, 10, 20, 0.62)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function heart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -6, -11, 0, -5);
  ctx.bezierCurveTo(6, -11, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff6b81' : 'rgba(255, 255, 255, 0.18)';
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, state, muted) {
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, 16, 14, 560, 54, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(`Score ${state.score}`, 34, 42);
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Pearls ${state.pearlsCollected}/${PEARLS_TO_WIN}`, 218, 42);
  ctx.fillText(`Level ${state.level}`, 372, 42);
  for (let i = 0; i < 3; i += 1) heart(ctx, 452 + i * 30, 42, 22, i < state.lives);

  // Light bar, right side.
  const barX = 640;
  const barWidth = 300;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, barX - 12, 14, barWidth + 84, 54, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('LIGHT', barX, 42);
  const lightWidth = (state.light / LIGHT_START) * barWidth;
  const lightColour = state.light > 35 ? '#ffd76a' : PALETTE.danger;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, barX + 58, 30, barWidth - 58, 20, 8);
  ctx.fill();
  ctx.fillStyle = lightColour;
  if (lightWidth > 0) {
    roundRect(ctx, barX + 58, 30, Math.max(10, lightWidth - 58), 20, 8);
    ctx.fill();
  }
  const tier = Math.min(3, 1 + Math.floor(state.chain / 5));
  if (state.chain >= 5) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`COMBO x${tier}`, FIELD.width - 24, 42);
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(muted ? 'M: sound off' : 'M: mute', FIELD.width - 24, 66);
  ctx.restore();
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, width, height, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawMenu(ctx, state, best, now) {
  const blink = Math.floor(now * 1.6) % 2 === 0;
  panel(ctx, 290, 128, 700, 470);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText('GLIMMERDEEP', FIELD.width / 2, 208);
  ctx.fillStyle = PALETTE.pearl;
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('A little lantern fish. A very dark reef.', FIELD.width / 2, 248);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '400 19px system-ui, sans-serif';
  ctx.fillText('Gather 30 pearls to light the way home.', FIELD.width / 2, 300);
  ctx.fillText('Glow orbs refill your lamp. Anglerfish bite — three bites end the dive.', FIELD.width / 2, 330);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('Move: Arrow keys / WASD, or hold the mouse', FIELD.width / 2, 386);
  ctx.fillText('Start: Enter, Space or click   •   Pause: P   •   Mute: M', FIELD.width / 2, 414);
  if (best > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`Best score: ${best}`, FIELD.width / 2, 452);
  }
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('Press Enter or click to dive', FIELD.width / 2, 520);
  }
}

function drawEnd(ctx, state, screen, best, now) {
  const won = screen === SCREEN_WIN;
  const blink = Math.floor(now * 1.6) % 2 === 0;
  panel(ctx, 330, 150, 620, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? PALETTE.gold : PALETTE.danger;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.fillText(won ? 'THE REEF IS LIT!' : 'THE LIGHT WENT OUT', FIELD.width / 2, 232);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '400 21px system-ui, sans-serif';
  ctx.fillText(
    won ? 'Luma gathered every pearl and the reef glows again.' : 'Luma drifted into the dark — the reef keeps its secrets.',
    FIELD.width / 2,
    282,
  );
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText(`Score ${state.score}`, FIELD.width / 2, 344);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText(`Pearls ${state.pearlsCollected} of ${PEARLS_TO_WIN}  •  Level ${state.level}  •  Best ${best}`, FIELD.width / 2, 384);
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('Press R or click to dive again', FIELD.width / 2, 470);
  }
}

function drawPaused(ctx, now) {
  ctx.fillStyle = 'rgba(2, 10, 20, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '800 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Press P to keep diving', FIELD.width / 2, FIELD.height / 2 + 34);
}

/** Draw one frame. `screen` is one of the SCREEN_* constants; `now` is seconds. */
export function render(ctx, state, screen, { best = 0, muted = false, now = 0 } = {}) {
  ctx.save();
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (state.shake > 0) {
    const magnitude = state.shake * 7;
    ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
  }
  drawBackground(ctx, state, now);
  drawPearls(ctx, state, now);
  drawAnglers(ctx, state);
  drawPlayer(ctx, state, now);
  drawBubbles(ctx, state);
  drawParticles(ctx, state);
  drawFloats(ctx, state);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawDarkness(ctx, state);
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) drawHud(ctx, state, muted);
  if (screen === SCREEN_MENU) drawMenu(ctx, state, best, now);
  if (screen === SCREEN_WIN || screen === SCREEN_LOSE) drawEnd(ctx, state, screen, best, now);
  if (screen === SCREEN_PAUSE) drawPaused(ctx, now);
  ctx.restore();
}
