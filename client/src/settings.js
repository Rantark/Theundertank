// PLAYER SETTINGS
// Defaults, key/button bindings and human-readable labels. Stored in the save file under
// `settings`; missing fields are filled from these defaults so old saves keep working.
import { PAD } from './input/InputManager.js';

export const SETTINGS_VERSION = 2;

// Keyboard bindings: action -> list of KeyboardEvent.code values (first one is shown in hints).
export const DEFAULT_KEYS = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  aimUp: ['ArrowUp'],
  aimDown: ['ArrowDown'],
  aimLeft: ['ArrowLeft'],
  aimRight: ['ArrowRight'],
  dash: ['Space', 'ShiftLeft'],
  active: ['KeyQ'],
  cons: ['KeyF'],
  interact: ['KeyE'],
  ping: ['KeyC'],
  pause: ['Escape', 'KeyP'],
};

// Gamepad bindings (standard mapping button indices).
export const DEFAULT_PAD = {
  dash: [PAD.A, PAD.LT, PAD.RB],
  active: [PAD.Y],
  cons: [PAD.LB, PAD.B],
  interact: [PAD.X],
  ping: [PAD.UP, PAD.RS],
  fire: [PAD.RT],
};

export const ACTION_LABELS = {
  up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT',
  aimUp: 'SHOOT UP', aimDown: 'SHOOT DOWN', aimLeft: 'SHOOT LEFT', aimRight: 'SHOOT RIGHT',
  dash: 'DASH', active: 'ACTIVE ITEM', cons: 'CONSUMABLE', interact: 'INTERACT / BUY', ping: 'PING', pause: 'PAUSE', fire: 'FIRE',
};

export function defaultSettings() {
  return {
    version: SETTINGS_VERSION,
    sfx: 0.7,
    music: 0.5,
    shake: 0.35, // 0 = off, 1 = full
    hitstop: true,
    flashes: true,
    damageNumbers: true,
    showFps: false,
    autoFire: false, // mouse players: fire continuously toward the cursor
    fullscreen: false,
    keys: structuredClone(DEFAULT_KEYS),
    pad: structuredClone(DEFAULT_PAD),
  };
}

/** Merge a stored settings object over the defaults (and migrate old versions). */
export function loadSettings(stored = {}) {
  const def = defaultSettings();
  const s = { ...def, ...stored, keys: { ...def.keys, ...(stored.keys || {}) }, pad: { ...def.pad, ...(stored.pad || {}) } };
  if (!stored.version || stored.version < 2) {
    // v2 toned screen shake down a lot; reset anyone still on the old punchy default.
    s.shake = Math.min(s.shake ?? def.shake, def.shake);
  }
  s.version = SETTINGS_VERSION;
  return s;
}

const KEY_NAMES = {
  Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
  Escape: 'ESC', Enter: 'ENTER', Backspace: 'BACKSPACE', Tab: 'TAB', CapsLock: 'CAPS', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
};

export function keyName(code) {
  if (!code) return '---';
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  return code.toUpperCase();
}

const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3', 'D-UP', 'D-DOWN', 'D-LEFT', 'D-RIGHT', 'HOME'];
export function padName(b) {
  return PAD_NAMES[b] ?? `B${b}`;
}
