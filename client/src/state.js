// Global client state shared by all scenes.
import { InputManager } from './input/InputManager.js';
import { Audio } from './audio/Audio.js';
import { Save } from './save.js';

export const App = {
  save: new Save(),
  input: new InputManager(),
  audio: null,
  net: null, // NetClient when playing online
  lastSummary: null,
};
App.audio = new Audio(App.save.data.settings);
App.input.settings = App.save.data.settings;

// Screen layout (base resolution 480x270). The room is drawn at ROOM_X/ROOM_Y.
// Every scene lays out in a 480x270 logical space; cameras zoom 2x onto a 960x540 canvas.
// All art is authored at 2x density and drawn at ART scale, so sprites carry twice the
// pixel detail of the logical grid (e.g. characters are 32x64 textures, 16x32 on screen).
export const SCREEN_W = 480;
export const SCREEN_H = 270;
export const ZOOM = 2;
export const ART = 1 / ZOOM;

/** Zoom a scene's main camera so its logical 480x270 space fills the canvas. */
export function setupCamera(scene) {
  const cam = scene.cameras.main;
  cam.setOrigin(0, 0);
  cam.setZoom(ZOOM);
  return cam;
}
export const ROOM_X = 56;
export const ROOM_Y = 58;

// Exposed for debugging from the browser console.
window.__app = App;
