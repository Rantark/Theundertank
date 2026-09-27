import Phaser from 'phaser';
import { generateSprites } from '../gfx/sprites.js';
import { buildFont } from '../gfx/font.js';

// Generates every texture procedurally, then shows the title.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    buildFont(this);
    generateSprites(this);
    this.scene.start('Title');
  }
}
