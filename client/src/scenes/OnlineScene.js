import Phaser from 'phaser';
import { App } from '../state.js';
import { text, COLORS } from '../ui/text.js';

// Placeholder until milestone 8 wires up the Socket.IO client.
export class OnlineScene extends Phaser.Scene {
  constructor() {
    super('Online');
  }

  create() {
    text(this, 240, 120, 'ONLINE CO-OP ARRIVES IN MILESTONE 8', { origin: [0.5, 0.5], color: COLORS.dim });
    text(this, 240, 140, 'PRESS BACK', { origin: [0.5, 0.5] });
  }

  update() {
    App.input.poll(this.input.activePointer);
    if (App.input.menu('back') || App.input.menu('confirm')) this.scene.start('Title');
    App.input.endFrame();
  }
}
