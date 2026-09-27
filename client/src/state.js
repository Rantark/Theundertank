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

// Screen layout (base resolution 480x270). The room is drawn at ROOM_X/ROOM_Y.
export const SCREEN_W = 480;
export const SCREEN_H = 270;
export const ROOM_X = 56;
export const ROOM_Y = 58;
