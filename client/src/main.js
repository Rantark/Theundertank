import Phaser from 'phaser';
import { SCREEN_W, SCREEN_H, ZOOM } from './state.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { TownScene } from './scenes/TownScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { SummaryScene } from './scenes/SummaryScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { OnlineScene } from './scenes/OnlineScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_W * ZOOM,
  height: SCREEN_H * ZOOM,
  backgroundColor: '#0d0b0a',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: false, keyboard: false },
  fps: { target: 60 },
  scene: [BootScene, TitleScene, TownScene, GameScene, HudScene, PauseScene, SummaryScene, ShopScene, OnlineScene],
});

// Handy for debugging from the console.
window.__undercrank = game;
