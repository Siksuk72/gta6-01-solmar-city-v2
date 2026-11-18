// Keyboard and mouse state. WASD move/drive, mouse drag orbits the camera,
// click shoots, E interacts/enters cars, Shift runs, Space jumps/handbrakes,
// R reloads, M toggles music, Esc/P pauses.
export class InputManager {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last consume
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.canvas = canvas;
    this.enabled = true;
    this.onFirstGesture = null;
    this.bound = false;
  }

  attach() {
    if (this.bound) return;
    this.bound = true;
    window.addEventListener('keydown', (event) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
      this.noteGesture();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      // Clear pressed too: a key tapped right as the window loses focus
      // would otherwise fire its one-shot action (jump, reload, interact)
      // the moment the player comes back.
      this.pressed.clear();
      this.mouseDown = false;
      this.dragging = false;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      if (!this.enabled) return;
      // Only the left button drives or shoots: a right-click drag must
      // never fire a shot or start a camera orbit.
      if (event.button !== 0) return;
      this.mouseDown = true;
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.noteGesture();
    });
    window.addEventListener('mousemove', (event) => {
      if (!this.dragging) return;
      this.mouseDX += event.clientX - this.lastX;
      this.mouseDY += event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
    });
    window.addEventListener('mouseup', (event) => {
      if (this.mouseDown && event.button === 0 && event.target === this.canvas) this.mouseClicked = true;
      if (event.button === 0) {
        this.mouseDown = false;
        this.dragging = false;
      }
    });
    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.wheelDelta += event.deltaY;
    }, { passive: false });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  noteGesture() {
    if (this.onFirstGesture) {
      const fn = this.onFirstGesture;
      this.onFirstGesture = null;
      fn();
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  consumePressed(code) {
    const had = this.pressed.has(code);
    this.pressed.delete(code);
    return had;
  }

  // Movement axes: forward (+1) / strafe right (+1), from WASD or arrows.
  moveAxes() {
    let forward = 0;
    let strafe = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) forward += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) forward -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) strafe += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) strafe -= 1;
    return { forward, strafe };
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.mouseClicked = false;
  }
}
