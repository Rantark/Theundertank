// UNIFIED INPUT
// Keyboard+mouse and up to four gamepads (Gamepad API, "standard" mapping).
// Devices are assigned to local player slots; each slot produces a sim input object.
// Button presses are exposed as ever-increasing counters (see sim/player.js) so they
// survive frame/tick mismatches and network batching.
import { emptyInput } from '@undercrank/shared';

const DEADZONE = 0.22;

// Standard gamepad button indices.
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const PAD_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT'];
function keyLabel(code) {
  const names = { Space: 'SPACE', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Escape: 'ESC', Enter: 'ENTER', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ControlLeft: 'CTRL', AltLeft: 'ALT', Tab: 'TAB' };
  if (names[code]) return names[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.toUpperCase();
}

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
    this.padCapture = null; // callback(button) while rebinding a gamepad action
    this.settings = null; // player settings (bindings, auto-fire); set by state.js

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
      // Convert canvas pixels into the 480x270 logical space all scenes use.
      const z = pointer.camera?.zoom || 2;
      const x = pointer.x / z;
      const y = pointer.y / z;
      if (x !== this.mouse.x || y !== this.mouse.y) this.mouse.moved = true;
      this.mouse.x = x;
      this.mouse.y = y;
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
          if (this.padCapture) {
            const cb = this.padCapture;
            this.padCapture = null;
            cb(bi, i);
          }
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
        left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], pause: this.binds('pause'), join: ['Enter'], leave: [], tab: ['Tab'],
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

  /** Keyboard codes bound to an action (from settings, with safe fallbacks). */
  binds(action) {
    return this.settings?.keys?.[action] || [];
  }

  padBinds(action) {
    return this.settings?.pad?.[action] || [];
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
      const held = (a) => this.binds(a).some((c) => this.keys.has(c));
      const hit = (a) => this.binds(a).some((c) => this.keysPressed.has(c));
      inp.mx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      inp.my = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
      // Shoot keys fire in that direction (classic twin-stick on keyboard).
      const axk = (held('aimRight') ? 1 : 0) - (held('aimLeft') ? 1 : 0);
      const ayk = (held('aimDown') ? 1 : 0) - (held('aimUp') ? 1 : 0);
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
        inp.fire = this.mouse.left || !!this.settings?.autoFire;
      }
      if (hit('dash') || this.mouse.rightPressed) s.dash++;
      if (hit('active')) s.active++;
      if (hit('cons')) s.cons++;
      if (hit('interact')) s.inter++;
      if (hit('ping') || this.mouse.middlePressed) s.ping++;
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
        if (this.padBinds('fire').some(down) && Math.hypot(rx, ry) < 0.3) {
          // Fire toward the last aim / move direction when only the trigger is held.
          inp.fire = true;
          inp.ax = inp.ax || lx * 0.3;
          inp.ay = inp.ay || ly * 0.3;
        }
        const pp = this.padPressed[i];
        const tap = (a) => this.padBinds(a).some((btn) => pp.has(btn));
        if (tap('dash')) s.dash++;
        if (tap('active')) s.active++;
        if (tap('cons')) s.cons++;
        if (tap('interact')) s.inter++;
        if (tap('ping')) s.ping++;
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

  /** Short hint for a given action on the device of a slot (reflects rebinding). */
  hint(slot, action) {
    const pad = this.slots[slot] && this.slots[slot] !== 'kbm';
    const act = { interact: 'interact', dash: 'dash', active: 'active', cons: 'cons', ping: 'ping', pause: 'pause' }[action];
    if (action === 'confirm') return pad ? 'A' : 'ENTER';
    if (action === 'back') return pad ? 'B' : 'ESC';
    if (pad) {
      if (action === 'pause') return 'START';
      const b = this.padBinds(act)[0];
      return b === undefined ? '?' : PAD_LABELS[b] ?? `B${b}`;
    }
    const code = this.binds(act)[0];
    return code ? keyLabel(code) : '?';
  }

}
