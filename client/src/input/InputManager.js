// UNIFIED INPUT
// Keyboard+mouse and up to four gamepads (Gamepad API, "standard" mapping).
// Devices are assigned to local player slots; each slot produces a sim input object.
// Button presses are exposed as ever-increasing counters (see sim/player.js) so they
// survive frame/tick mismatches and network batching.
import { emptyInput } from '@undercrank/shared';

const DEADZONE = 0.22;

// Standard gamepad button indices.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

function dz(v) {
  return Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE);
}

export class InputManager {
  constructor() {
    this.keys = new Set();
    this.keysPressed = new Set(); // pressed since last poll
    this.mouse = { x: 0, y: 0, left: false, right: false, middle: false, leftPressed: false, rightPressed: false, middlePressed: false, moved: false };
    this.pads = [null, null, null, null];
    this.padPrev = [[], [], [], []];
    this.padPressed = [new Set(), new Set(), new Set(), new Set()];
    this.padAxes = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    this.stickPrev = [[0, 0], [0, 0], [0, 0], [0, 0]];
    this.slots = ['kbm']; // device per local player slot
    this.seq = [0, 1, 2, 3].map(() => ({ dash: 0, active: 0, cons: 0, inter: 0, ping: 0 }));
    this.lastDevice = 'kbm';
    this.textCapture = null; // callback(key) when a text field is active

    window.addEventListener('keydown', (e) => {
      if (this.textCapture) {
        this.textCapture(e);
        e.preventDefault();
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.keysPressed.add(e.code);
      this.keys.add(e.code);
      this.lastDevice = 'kbm';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.left = this.mouse.right = this.mouse.middle = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
      if (e.button === 1) { this.mouse.middle = true; this.mouse.middlePressed = true; e.preventDefault(); }
      this.lastDevice = 'kbm';
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
      if (e.button === 1) this.mouse.middle = false;
    });
  }

  /** Called once per frame by the active scene with the Phaser pointer. */
  poll(pointer) {
    if (pointer) {
      if (pointer.x !== this.mouse.x || pointer.y !== this.mouse.y) this.mouse.moved = true;
      this.mouse.x = pointer.x;
      this.mouse.y = pointer.y;
    }
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < 4; i++) {
      const gp = gps[i];
      this.padPressed[i].clear();
      if (!gp || !gp.connected) {
        this.pads[i] = null;
        continue;
      }
      this.pads[i] = gp;
      const prev = this.padPrev[i];
      gp.buttons.forEach((b, bi) => {
        const down = b.pressed || b.value > 0.5;
        if (down && !prev[bi]) {
          this.padPressed[i].add(bi);
          this.lastDevice = `pad${i}`;
        }
        prev[bi] = down;
      });
      this.padAxes[i] = [dz(gp.axes[0] || 0), dz(gp.axes[1] || 0), dz(gp.axes[2] || 0), dz(gp.axes[3] || 0)];
      // Treat a flicked left stick as d-pad presses for menus.
      const [sx, sy] = this.padAxes[i];
      const [px, py] = this.stickPrev[i];
      if (sx > 0.6 && px <= 0.6) this.padPressed[i].add(PAD.RIGHT);
      if (sx < -0.6 && px >= -0.6) this.padPressed[i].add(PAD.LEFT);
      if (sy > 0.6 && py <= 0.6) this.padPressed[i].add(PAD.DOWN);
      if (sy < -0.6 && py >= -0.6) this.padPressed[i].add(PAD.UP);
      this.stickPrev[i] = [sx, sy];
      if (Math.abs(sx) + Math.abs(sy) > 0.5) this.lastDevice = `pad${i}`;
    }
  }

  /** Clear per-frame edge flags (call at end of frame). */
  endFrame() {
    this.keysPressed.clear();
    this.mouse.leftPressed = this.mouse.rightPressed = this.mouse.middlePressed = false;
    this.mouse.moved = false;
  }

  padIndex(device) {
    return device && device.startsWith('pad') ? Number(device.slice(3)) : -1;
  }

  pressedOn(device, what) {
    if (device === 'kbm') {
      const map = {
        confirm: ['Enter', 'Space', 'KeyE'], back: ['Escape', 'Backspace'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
        left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], pause: ['Escape', 'KeyP'], join: ['Enter'], leave: [], tab: ['Tab'],
      }[what];
      return map ? map.some((k) => this.keysPressed.has(k)) : false;
    }
    const i = this.padIndex(device);
    if (i < 0 || !this.pads[i]) return false;
    const pp = this.padPressed[i];
    const map = {
      confirm: [PAD.A], back: [PAD.B], up: [PAD.UP], down: [PAD.DOWN], left: [PAD.LEFT], right: [PAD.RIGHT], pause: [PAD.START],
      join: [PAD.START, PAD.A], leave: [PAD.BACK], tab: [PAD.BACK],
    }[what];
    return map ? map.some((b) => pp.has(b)) : false;
  }

  /** Menu navigation from any device (or a specific one). */
  menu(what, device = null) {
    if (device) return this.pressedOn(device, what);
    if (this.pressedOn('kbm', what)) return true;
    for (let i = 0; i < 4; i++) if (this.pressedOn(`pad${i}`, what)) return true;
    return false;
  }

  /** Any "start" press from a device that isn't assigned yet (for joining). */
  joinRequest() {
    if (!this.slots.includes('kbm') && (this.keysPressed.has('Enter') || this.keysPressed.has('Space'))) return 'kbm';
    for (let i = 0; i < 4; i++) {
      const d = `pad${i}`;
      if (this.slots.includes(d) || !this.pads[i]) continue;
      if (this.padPressed[i].has(PAD.START) || this.padPressed[i].has(PAD.A)) return d;
    }
    return null;
  }

  /** Any press on any device (title screen). */
  anyPress() {
    if (this.keysPressed.size || this.mouse.leftPressed) return 'kbm';
    for (let i = 0; i < 4; i++) if (this.padPressed[i].size) return `pad${i}`;
    return null;
  }

  assignSlot(slot, device) {
    this.slots[slot] = device;
  }

  addSlot(device) {
    if (this.slots.length >= 4 || this.slots.includes(device)) return -1;
    this.slots.push(device);
    return this.slots.length - 1;
  }

  removeSlot(slot) {
    if (slot <= 0) return;
    this.slots.splice(slot, 1);
  }

  slotOfDevice(device) {
    return this.slots.indexOf(device);
  }

  /**
   * Build the simulation input for a local slot.
   * @param {number} slot
   * @param {{x:number,y:number}} playerScreen player position in screen pixels (for mouse aim)
   * @param {{x:number,y:number}} mouseWorld mouse position in world coordinates (for pings)
   */
  playerInput(slot, playerScreen, mouseWorld) {
    const device = this.slots[slot];
    const inp = emptyInput();
    const s = this.seq[slot];
    if (device === 'kbm') {
      const k = this.keys;
      inp.mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      inp.my = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
      // Arrow keys shoot in that direction (classic twin-stick on keyboard).
      const axk = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
      const ayk = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
      if (axk || ayk) {
        inp.ax = axk;
        inp.ay = ayk;
        inp.fire = true;
      } else if (playerScreen) {
        inp.ax = this.mouse.x - playerScreen.x;
        inp.ay = this.mouse.y - playerScreen.y;
        const l = Math.hypot(inp.ax, inp.ay) || 1;
        inp.ax /= l;
        inp.ay /= l;
        inp.ax *= 0.3; // below auto-fire threshold: mouse aim only fires on click
        inp.ay *= 0.3;
        inp.fire = this.mouse.left;
      }
      const kp = this.keysPressed;
      if (kp.has('Space') || kp.has('ShiftLeft') || kp.has('ShiftRight') || this.mouse.rightPressed) s.dash++;
      if (kp.has('KeyQ')) s.active++;
      if (kp.has('KeyF')) s.cons++;
      if (kp.has('KeyE')) s.inter++;
      if (kp.has('KeyC') || this.mouse.middlePressed) s.ping++;
      if (mouseWorld) {
        inp.px = mouseWorld.x;
        inp.py = mouseWorld.y;
      }
    } else {
      const i = this.padIndex(device);
      const gp = this.pads[i];
      if (gp) {
        const [lx, ly, rx, ry] = this.padAxes[i];
        inp.mx = lx;
        inp.my = ly;
        inp.ax = rx;
        inp.ay = ry;
        const b = gp.buttons;
        const down = (n) => b[n] && (b[n].pressed || b[n].value > 0.5);
        if (down(PAD.RT) && Math.hypot(rx, ry) < 0.3) {
          // Fire toward the last aim / move direction when only the trigger is held.
          inp.fire = true;
          inp.ax = inp.ax || lx * 0.3;
          inp.ay = inp.ay || ly * 0.3;
        }
        const pp = this.padPressed[i];
        if (pp.has(PAD.A) || pp.has(PAD.LT) || pp.has(PAD.RB)) s.dash++;
        if (pp.has(PAD.Y)) s.active++;
        if (pp.has(PAD.LB) || pp.has(PAD.B)) s.cons++;
        if (pp.has(PAD.X)) s.inter++;
        if (pp.has(PAD.UP) || pp.has(PAD.RS)) s.ping++;
      }
    }
    inp.dash = s.dash;
    inp.active = s.active;
    inp.cons = s.cons;
    inp.inter = s.inter;
    inp.ping = s.ping;
    return inp;
  }

  deviceLabel(device) {
    return device === 'kbm' ? 'KEYBOARD' : `PAD ${this.padIndex(device) + 1}`;
  }

  /** Short hint for a given action on the device of a slot. */
  hint(slot, action) {
    const pad = this.slots[slot] !== 'kbm';
    const H = pad
      ? { interact: 'X', dash: 'A', active: 'Y', cons: 'LB', ping: 'UP', confirm: 'A', back: 'B', pause: 'START' }
      : { interact: 'E', dash: 'SPACE', active: 'Q', cons: 'F', ping: 'C', confirm: 'ENTER', back: 'ESC', pause: 'ESC' };
    return H[action] || '?';
  }
}
