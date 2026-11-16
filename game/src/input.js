// Keyboard and mouse, read by the loop each step. Held keys live in a set so several
// can be down at once; edge-triggered presses live in a second set the loop drains once
// per step. The pointer steers the fish only while it is held down, and every coordinate
// the game sees is already converted into the playfield's logical space.

const MOVE_KEYS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
};

const DASH_KEYS = ['ShiftLeft', 'ShiftRight'];

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, down: false };
    this.pressed = new Set();
    this.canvas = canvas;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.bindKeyboard();
    this.bindPointer(canvas);
  }

  bindKeyboard() {
    window.addEventListener('keydown', (event) => {
      if (MOVE_KEYS[event.code] !== undefined) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointer.down = false;
    });
  }

  bindPointer(canvas) {
    const track = (event) => {
      const rect = canvas.getBoundingClientRect();
      this.pointer.x = (event.clientX - rect.left - this.offsetX) / this.scale;
      this.pointer.y = (event.clientY - rect.top - this.offsetY) / this.scale;
    };
    canvas.addEventListener('pointerdown', (event) => {
      track(event);
      this.pointer.down = true;
      this.pressed.add('Pointer');
    });
    window.addEventListener('pointermove', track);
    window.addEventListener('pointerup', () => {
      this.pointer.down = false;
    });
  }

  /** The renderer's current mapping from screen pixels to logical playfield pixels. */
  setViewport(scale, offsetX, offsetY) {
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  held(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  /** The steering the player asked for this step: -1, 0 or 1 on each axis, or a pointer target. */
  steering() {
    const x = (this.held('ArrowRight', 'KeyD') ? 1 : 0) - (this.held('ArrowLeft', 'KeyA') ? 1 : 0);
    const y = (this.held('ArrowDown', 'KeyS') ? 1 : 0) - (this.held('ArrowUp', 'KeyW') ? 1 : 0);
    return {
      x,
      y,
      pointer: this.pointer.down ? { x: this.pointer.x, y: this.pointer.y } : null,
      dash: this.held(...DASH_KEYS),
    };
  }

  /** True once for a key or pointer press since the last call; used for menu actions. */
  takePressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Clear the edge-triggered presses (call once per step, after the state machine read them). */
  endStep() {
    this.pressed.clear();
  }
}
