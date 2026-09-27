// WORLD RENDERER
// Mirrors simulation entities (local Game or decoded network snapshot — both expose the
// same field names) into pooled Phaser game objects every frame.
import Phaser from 'phaser';
import { ROOM_PX_W, ROOM_PX_H, DIRS, DOOR_TILE, TILE, ITEM_MAP, CONSUMABLE_MAP, PLAYER_COLORS, RARITY_COLORS, availableTo, itemDetails, wouldActivate } from '@undercrank/shared';
import { buildRoomLayer, doorTexture, doorTransform } from './roomRenderer.js';
import { text, setText, COLORS, rarityColor } from '../ui/text.js';
import { ART } from '../state.js';
import { charFrame, CHAR_ORIGIN_Y } from './anim.js';

// Normalisers so local sim objects and decoded snapshots render identically.
const isDashing = (p) => p.dashing ?? p.dashT > 0;
const hpFrac = (e) => e.hpFrac ?? e.hp / e.maxHp;
const burning = (e) => e.burning ?? !!e.status?.burn;
const slowed = (e) => e.slowed ?? !!e.status?.slow;
const fused = (e) => e.fuse ?? e.st?.mode === 'fuse';
const lifeFrac = (z) => z.lifeFrac ?? z.life / (z.maxLife || 1);

// Animation speed (frames/second while moving) per enemy type.
const ANIM_RATE = { cogling: 14, gear_spinner: 12, boiler_bomb: 8, coil_wraith: 9, pipe_worm: 6, tinker_mother: 10, smog_bellows: 5, brass_sentinel: 6, rivet_turret: 4 };

export class WorldRenderer {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.maps = { players: new Map(), enemies: new Map(), projectiles: new Map(), pickups: new Map(), zones: new Map(), allies: new Map(), pings: new Map() };
    this.frame = 0;
    this.roomKey = null;
    this.layer = null;
    this.doors = [];
    this.hatch = null;
    this.feature = null;
    this.time = 0;
    this.blackout = null;
    this.localIds = [];
    this.hurtFlash = new Map();
    this.timeStopOverlay = scene.add.rectangle(ROOM_PX_W / 2, ROOM_PX_H / 2, ROOM_PX_W, ROOM_PX_H, 0x5a7aa0, 0.0).setDepth(590).setBlendMode('MULTIPLY');
  }

  // ------------------------------------------------------------------ room
  setRoom(view) {
    const room = view.room;
    const key = `${view.depth}:${room.id}`;
    if (this.roomKey === key) return false;
    this.roomKey = key;
    if (this.layer) {
      this.layer.rt.destroy();
      for (const l of this.layer.lamps) {
        l.lamp.destroy();
        l.glow.destroy();
      }
    }
    for (const d of this.doors) d.img.destroy();
    this.doors = [];
    this.layer = buildRoomLayer(this.scene, room, view.floor);
    for (const dir of DIRS) {
      if (!room.doors[dir]) continue;
      const tr = doorTransform(dir);
      const img = this.scene.add.image(tr.x, tr.y, doorTexture(room, view.floor, dir)).setRotation(tr.rot).setDepth(2).setScale(ART);
      const [tx, ty] = DOOR_TILE[dir];
      const crack = this.scene.add.image(tx * TILE + 8, ty * TILE + 8, 'wall_cracked').setDepth(2).setScale(ART);
      this.doors.push({ dir, img, crack });
    }
    // Clear transient pools so nothing from the previous room lingers.
    for (const k of ['projectiles', 'zones', 'pings', 'pickups', 'enemies']) {
      for (const s of this.maps[k].values()) this.destroyObj(s);
      this.maps[k].clear();
    }
    if (this.hatch) {
      this.hatch.destroy();
      this.hatch = null;
    }
    if (this.feature) {
      this.feature.img.destroy();
      this.feature.label?.destroy();
      this.feature = null;
    }
    const blackout = view.floor.modifiers.includes('blackout');
    if (blackout && !this.blackout) {
      this.blackout = this.scene.add.renderTexture(0, 0, ROOM_PX_W, ROOM_PX_H).setOrigin(0, 0).setDepth(600);
      this.lightStamp = this.scene.make.image({ key: 'glow', add: false });
    } else if (!blackout && this.blackout) {
      this.blackout.destroy();
      this.blackout = null;
    }
    return true;
  }

  destroyObj(o) {
    for (const k in o) {
      const v = o[k];
      if (Array.isArray(v)) v.forEach((x) => x && typeof x.destroy === 'function' && x.destroy());
      else if (v && typeof v.destroy === 'function') v.destroy();
    }
  }

  sync(mapName, list, create, update) {
    const map = this.maps[mapName];
    const f = this.frame;
    for (const o of list) {
      let s = map.get(o.id);
      if (!s) {
        s = create(o);
        map.set(o.id, s);
      }
      s._f = f;
      update(s, o);
    }
    for (const [id, s] of map) {
      if (s._f !== f) {
        this.destroyObj(s);
        map.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ main
  render(view, dt, localIds) {
    this.frame++;
    this.time += dt;
    this.localIds = localIds;
    const S = this.scene;
    const t = this.time;
    const room = view.room;
    this.setRoom(view);

    // Lamps flicker.
    for (const l of this.layer.lamps) l.glow.setAlpha(0.28 + Math.sin(t * 7 + l.phase) * 0.04 + Math.random() * 0.03);

    // Doors
    for (const d of this.doors) {
      const hidden = room.hidden[d.dir];
      d.img.setVisible(!hidden);
      d.crack.setVisible(!!hidden);
      if (!hidden) d.img.setTexture(doorTexture(room, view.floor, d.dir));
    }

    // Hatch
    if (room.hatch && !this.hatch) {
      this.hatch = S.add.image(ROOM_PX_W / 2, ROOM_PX_H / 2, 'hatch_open').setDepth(6).setScale(ART);
      this.fx.ring(ROOM_PX_W / 2, ROOM_PX_H / 2, 30, 0xffc93c, 500);
    }
    if (this.hatch) this.hatch.setScale(ART * (1 + Math.min(1, (view.hatchT || 0) / 0.9) * 0.3)).setRotation(this.time * 0.5);

    // Room feature (bench, lever, shopkeeper)
    if (room.feature && !this.feature) {
      const f = room.feature;
      const tex = f.kind === 'bench' ? 'bench' : f.kind === 'lever' ? 'lever' : 'npc_shopkeeper_down_idle0';
      this.feature = { img: S.add.image(f.x, f.y, tex).setDepth(100 + f.y).setScale(ART) };
      if (f.kind === 'shopkeeper') this.feature.img.setOrigin(0.5, CHAR_ORIGIN_Y);
      if (f.kind === 'shopkeeper') this.feature.label = text(S, f.x, f.y - 22, 'WARES FOR COGS', { origin: [0.5, 1], color: COLORS.verdigris, depth: 700 });
    }
    if (this.feature && room.feature?.kind === 'lever') this.feature.img.setTexture(room.feature.used ? 'lever_on' : 'lever');

    this.renderZones(view);
    this.renderPickups(view);
    this.renderPlayers(view);
    this.renderEnemies(view);
    this.renderProjectiles(view);
    this.renderAllies(view);
    this.renderPings(view);

    this.timeStopOverlay.setFillStyle(0x6a8ab0, view.timeStop > 0 ? 0.55 : 0).setAlpha(view.timeStop > 0 ? 1 : 0);
    if (this.blackout) this.renderBlackout(view);
  }

  renderBlackout(view) {
    const rt = this.blackout;
    rt.clear();
    rt.fill(0x000000, 0.9);
    const st = this.lightStamp;
    for (const p of view.players) {
      if (!p.alive) continue;
      st.setScale(2.6);
      rt.erase(st, p.x, p.y);
    }
    for (const l of this.layer.lamps) {
      st.setScale(1.2);
      rt.erase(st, l.x, l.y);
    }
    for (const pr of view.projectiles) {
      if (pr.team !== 'enemy') continue;
      st.setScale(0.25);
      rt.erase(st, pr.x, pr.y);
    }
  }

  // ------------------------------------------------------------------ players
  renderPlayers(view) {
    const S = this.scene;
    const multi = view.players.length > 1;
    this.sync('players', view.players, (p) => {
      const o = {
        shadow: S.add.image(0, 0, 'shadow').setDepth(50).setScale(ART * 1.1),
        ring: S.add.image(0, 0, `ring_${p.slot % 4}`).setDepth(51).setVisible(multi).setScale(ART),
        body: S.add.sprite(0, 0, `pl_${p.character || 'tinker'}_down_idle0`).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(ART),
        gun: S.add.image(0, 0, 'gun').setOrigin(0.25, 0.5).setScale(ART),
        label: text(S, 0, 0, `P${p.slot + 1}`, { origin: [0.5, 1], color: PLAYER_COLORS[p.slot % 4], depth: 640 }).setVisible(multi),
        revive: S.add.graphics().setDepth(645),
        afterT: 0,
        squash: 0,
        wasDashing: false,
      };
      return o;
    }, (o, p) => {
      const alive = p.alive;
      for (const k of ['shadow', 'ring', 'body', 'gun']) o[k].setVisible(alive && (k !== 'ring' || multi));
      o.label.setVisible(alive && multi);
      o.revive.clear();
      if (!alive) return;
      const prefix = `pl_${p.character || 'tinker'}`;
      const speed = Math.hypot(p.vx || 0, p.vy || 0);
      const moving = speed > 15;
      const dashing = isDashing(p);
      const moveAng = Math.atan2(p.vy || 0, p.vx || 0);
      const fr = charFrame(prefix, p.aim, moving, this.time + p.slot * 0.13, dashing, moveAng);
      if (p.downed) {
        o.body.setTexture(`${prefix}_side_idle0`).setFlipX(false).setRotation(Math.PI / 2).setTint(0x8a8a8a).setOrigin(0.5, 0.75);
      } else o.body.setTexture(fr.key).setFlipX(fr.flip).setRotation(0).setOrigin(0.5, CHAR_ORIGIN_Y);
      // Squash on dash start, stretch while dashing.
      if (dashing && !o.wasDashing) o.squash = 1;
      o.wasDashing = dashing;
      o.squash = Math.max(0, o.squash - 0.12);
      const sx = ART * (1 + o.squash * 0.25);
      const sy = ART * (1 - o.squash * 0.2);
      o.body.setScale(sx, sy);
      o.body.setPosition(p.x, p.y);
      o.shadow.setPosition(p.x, p.y + 5);
      o.ring.setPosition(p.x, p.y + 5);
      o.label.setPosition(p.x, p.y - 22);
      o.body.setDepth(100 + p.y);
      // The gun is held at hand height; behind the body when aiming away from the camera.
      const left = Math.cos(p.aim) < 0;
      o.gun.setPosition(p.x + Math.cos(p.aim) * 3, p.y - 3 + Math.sin(p.aim) * 2);
      o.gun.setRotation(p.aim).setFlipY(left);
      o.gun.setDepth(100 + p.y + (fr.view === 'up' ? -0.5 : 0.5));
      // Overheat glows the barrel.
      const heat = p.loadout?.stats?.sustainRamp ? Math.min(1, (p.sustain * p.loadout.stats.sustainRamp) / p.loadout.stats.sustainMax) : 0;
      if (heat > 0.05) {
        o.gun.setTint(Phaser.Display.Color.GetColor(255, Math.round(255 - heat * 140), Math.round(255 - heat * 220)));
        if (Math.random() < heat * 0.4) this.fx.ember.explode(1, o.gun.x + Math.cos(p.aim) * 8, o.gun.y + Math.sin(p.aim) * 8);
      } else o.gun.clearTint();

      if (p.downed) {
        o.gun.setVisible(false);
        // Revive ring: remaining window (red) and progress (green).
        const g = o.revive;
        const win = p.loadout?.stats?.reviveWindow || 10;
        g.lineStyle(2, 0xff4050, 0.9);
        g.beginPath();
        g.arc(p.x, p.y - 2, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, p.downedT / win));
        g.strokePath();
        if (p.reviveProgress > 0) {
          g.lineStyle(2, 0x8fd14f, 1);
          g.beginPath();
          g.arc(p.x, p.y - 2, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.reviveProgress / 1.5));
          g.strokePath();
        }
        return;
      }
      const hurtT = this.hurtFlash.get(p.id) || 0;
      if (hurtT > this.time) o.body.setTintFill(0xff4040);
      else if (p.invuln > 0) o.body.setTint(0x9aa8c0);
      else if (p.overdrive > 0) o.body.setTint(Math.floor(this.time * 20) % 2 ? 0xffd08a : 0xffffff);
      else o.body.clearTint();
      const blink = p.iframes > 0 && !dashing && Math.floor(this.time * 20) % 2 === 0;
      o.body.setAlpha(blink ? 0.35 : 1);
      o.gun.setAlpha(blink ? 0.35 : 1).setVisible(!dashing);
      // Dash afterimages.
      if (dashing) {
        o.afterT -= 1;
        if (o.afterT <= 0) {
          o.afterT = 2;
          const ghost = this.scene.add.image(p.x, p.y, o.body.texture.key).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(ART).setFlipX(fr.flip).setDepth(99 + p.y).setTint(PLAYER_COLORS[p.slot % 4]).setAlpha(0.5).setBlendMode('ADD');
          this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 200, onComplete: () => ghost.destroy() });
        }
      }
    });
  }

  // ------------------------------------------------------------------ enemies
  renderEnemies(view) {
    const S = this.scene;
    this.sync('enemies', view.enemies, (e) => {
      const key = e.boss ? `boss_${e.type}_0` : `en_${e.type}_0`;
      const o = {
        shadow: S.add.image(0, 0, e.boss ? 'shadow_big' : 'shadow').setDepth(50),
        spr: S.add.sprite(0, 0, key).setScale(ART),
        phase: Math.random() * 10,
        anim: Math.random() * 4,
        lx: e.x,
        ly: e.y,
        pop: 1,
        lastH: 0,
      };
      if (e.type === 'rivet_turret') o.barrel = S.add.image(0, 0, 'turret_barrel').setOrigin(0.15, 0.5).setScale(ART);
      if (e.type === 'brass_sentinel') o.shield = S.add.image(0, 0, 'sentinel_shield').setScale(ART);
      if (e.elite) o.aura = S.add.image(0, 0, 'glow').setBlendMode('ADD').setTint(0xffc93c).setAlpha(0.35).setScale(0.5).setDepth(49);
      return o;
    }, (o, e) => {
      const dt = 1 / 60;
      const moved = Math.hypot(e.x - o.lx, e.y - o.ly);
      o.lx = e.x;
      o.ly = e.y;
      // Walk cycles advance with movement; idle enemies still breathe slowly.
      const rate = ANIM_RATE[e.type] ?? 8;
      o.anim += dt * (moved > 0.05 ? rate : rate * 0.35);
      let f = Math.floor(o.anim) % 4;
      const h = e.h || 0;
      if (e.type === 'spring_hopper') f = h > 2 ? 3 : e.flash > 0 ? 2 : Math.floor(this.time * 2 + o.phase) % 2;
      if (e.type === 'boiler_bomb' && fused(e)) f = Math.floor(this.time * 16) % 4;
      let key = e.boss ? `boss_${e.type}_${Math.floor(o.anim * 0.6) % 4}` : `en_${e.type}_${f}`;
      if (e.burrowed) key = 'mound';
      o.spr.setTexture(key);
      // Landing squash for hoppers and bosses.
      if (o.lastH > 2 && h <= 0.5) o.pop = 0.35;
      o.lastH = h;
      o.pop = Math.max(0, o.pop - 0.06);
      const bob = !e.boss && moved > 0.05 && !e.flying ? Math.abs(Math.sin(o.anim * Math.PI)) * 0.6 : 0;
      const hover = e.flying && !e.boss ? Math.sin(this.time * 4 + o.phase) * 1.2 : 0;
      o.spr.setPosition(e.x, e.y - h - (e.boss ? 8 : 2) - bob + hover);
      o.spr.setDepth(100 + e.y);
      const sw = e.boss ? 40 : 16;
      o.shadow.setPosition(e.x, e.y + e.r * 0.7).setScale(Math.max(0.4, 1 - h / 60) * (e.r / 6) * ART * (e.boss ? 0.8 : 1.4));
      o.shadow.setVisible(!e.burrowed);
      void sw;
      const faceLeft = Math.cos(e.facing || 0) < 0;
      if (e.type === 'gear_spinner') o.spr.setRotation(this.time * 8);
      else if (!e.boss && e.type !== 'rivet_turret') o.spr.setFlipX(faceLeft);
      const base = (e.elite ? 1.25 : 1) * ART;
      // Spawn-in pops from small to full size; windups swell slightly.
      const spawnK = e.spawning > 0 ? 0.5 : 1;
      const wind = e.flash > 0 && !e.boss ? 1.08 : 1;
      const squashX = 1 + o.pop * 0.4;
      const squashY = 1 - o.pop * 0.3;
      o.spr.setScale(base * spawnK * wind * squashX, base * spawnK * wind * squashY);
      let alpha = 1;
      if (e.spawning > 0) alpha = 0.5;
      if (e.fading) alpha = 0.25;
      if (e.boss && e.untargetable) alpha = 0.6 + Math.sin(this.time * 20) * 0.3;
      o.spr.setAlpha(alpha);
      if (e.flash > 0 && e.boss) o.spr.setTint(0xff8a8a);
      else if (e.flash > 0) o.spr.setTintFill(0xffffff);
      else if (fused(e)) o.spr.setTint(Math.floor(this.time * 16) % 2 ? 0xff5040 : 0xffffff);
      else if (burning(e)) o.spr.setTint(Math.floor(this.time * 10) % 2 ? 0xffa060 : 0xffd0a0);
      else if (slowed(e)) o.spr.setTint(0x9fc8ff);
      else if (e.elite) o.spr.setTint(0xffe6a0);
      else o.spr.clearTint();
      if (burning(e) && Math.random() < 0.25) this.fx.ember.explode(1, e.x + (Math.random() - 0.5) * 8, e.y - 4);
      if (o.aura) o.aura.setPosition(e.x, e.y).setScale(0.45 + Math.sin(this.time * 5) * 0.05);
      if (o.barrel) o.barrel.setPosition(e.x, e.y - 5).setRotation(e.facing).setDepth(101 + e.y);
      if (o.shield) {
        o.shield.setPosition(e.x + Math.cos(e.facing) * 9, e.y - 3 + Math.sin(e.facing) * 9).setRotation(e.facing).setDepth(100 + e.y + Math.sin(e.facing));
      }
      // Elite health bar.
      if (e.elite && !e.boss) {
        if (!o.bar) o.bar = S.add.graphics().setDepth(630);
        o.bar.clear();
        const fr = hpFrac(e);
        if (fr < 1) {
          o.bar.fillStyle(0x000000, 0.8).fillRect(e.x - 8, e.y - e.r - 8 - h, 16, 3);
          o.bar.fillStyle(0xffc93c, 1).fillRect(e.x - 7, e.y - e.r - 7 - h, 14 * fr, 1);
        }
      }
    });
  }

  // ------------------------------------------------------------------ projectiles
  renderProjectiles(view) {
    const S = this.scene;
    this.sync('projectiles', view.projectiles, (p) => {
      const o = { spr: S.add.image(p.x, p.y, 'shot_brass').setDepth(p.team === 'enemy' ? 420 : 410) };
      if (p.kind === 'bomb' || p.kind === 'boulder') o.shadow = S.add.image(p.x, p.y, 'shadow').setDepth(50).setScale(0.6 * ART);
      return o;
    }, (o, p) => {
      let key;
      if (p.team === 'enemy') key = { big: 'eshot_big', fire: 'eshot_fire', orb: 'eshot_orb', boulder: 'boulder', bomb: 'bomb' }[p.kind] || 'eshot';
      else key = { shard: 'shot_shard', crit: 'shot_crit', bomb: 'bomb' }[p.kind] || `shot_${p.color || 'brass'}`;
      if (o.spr.texture.key !== key) o.spr.setTexture(key);
      const h = p.h || 0;
      o.spr.setPosition(p.x, p.y - h);
      if (p.team === 'player') {
        o.spr.setScale(ART * Math.max(0.6, p.r / 2.5));
        if (p.kind === 'shard') o.spr.setRotation(p.ang);
      } else {
        const base = p.kind === 'boulder' || p.kind === 'bomb' ? 1 + h / 40 : 1;
        o.spr.setScale(ART * base * (1 + Math.sin(this.time * 18 + p.id) * 0.08));
      }
      if (o.shadow) o.shadow.setPosition(p.x, p.y + 2);
    });
  }

  // ------------------------------------------------------------------ pickups
  renderPickups(view) {
    const S = this.scene;
    const locals = view.players.filter((p) => this.localIds.includes(p.id));
    const visibleFor = (pk) => locals.filter((p) => availableTo(pk, p));
    const list = view.pickups.filter((pk) => visibleFor(pk).length > 0);
    this.sync('pickups', list, (pk) => {
      const o = { phase: Math.random() * 6 };
      if (pk.type === 'cog') o.spr = S.add.image(pk.x, pk.y, pk.value >= 5 ? 'cog5' : 'cog1').setScale(ART);
      else if (pk.type === 'heart') o.spr = S.add.image(pk.x, pk.y, pk.value >= 2 ? 'heart' : 'heart_half').setScale(ART);
      else {
        const isItem = pk.type === 'item';
        const rarity = isItem ? ITEM_MAP[pk.itemId]?.rarity : 'common';
        if (pk.pedestal) o.ped = S.add.image(pk.x, pk.y + 6, 'pedestal').setDepth(99 + pk.y).setScale(ART);
        o.glow = S.add.image(pk.x, pk.y, 'glow').setBlendMode('ADD').setTint(RARITY_COLORS[rarity] || 0xffffff).setAlpha(0.45).setScale(0.5).setDepth(98 + pk.y);
        o.spr = S.add.image(pk.x, pk.y, isItem ? `item_${pk.itemId}` : `cons_${pk.consId}`).setScale(ART);
        o.card = null; // info card, built when a local player walks up
      }
      if (pk.price > 0) {
        o.price = text(S, pk.x + 3, pk.y + 16, `${pk.price}`, { origin: [0.5, 0.5], color: COLORS.brass, depth: 650 });
        o.priceCog = S.add.image(pk.x - 6 - String(pk.price).length * 2, pk.y + 16, 'ui_cog').setDepth(650).setScale(0.8 * ART);
      }
      return o;
    }, (o, pk) => {
      const bob = pk.type === 'item' || pk.type === 'consumable' ? Math.sin(this.time * 3 + o.phase) * 2 - 4 : Math.sin(this.time * 5 + o.phase) * 1;
      o.spr.setPosition(pk.x, pk.y + bob).setDepth(100 + pk.y);
      if (o.glow) o.glow.setPosition(pk.x, pk.y + bob).setScale(0.45 + Math.sin(this.time * 4 + o.phase) * 0.05);
      if (o.ped) o.ped.setPosition(pk.x, pk.y + 6);
      // Partially-claimed items (couch co-op) fade.
      const avail = visibleFor(pk).length;
      o.spr.setAlpha(avail < locals.length ? 0.55 : 1);
      if (o.card !== undefined) {
        const nearP = locals.find((p) => p.alive && availableTo(pk, p) && Math.hypot(p.x - pk.x, p.y - pk.y) < 34);
        if (nearP && (!o.card || o.cardFor !== nearP.id)) {
          if (o.card) o.card.destroy();
          o.card = this.buildCard(pk, nearP);
          o.cardFor = nearP.id;
        } else if (!nearP && o.card) {
          o.card.destroy();
          o.card = null;
          o.cardFor = null;
        }
      }
    });
  }

  /** Floating info card for an item/consumable pickup (name, tags, effects, synergies, prompt). */
  buildCard(pk, p) {
    const S = this.scene;
    const isItem = pk.type === 'item';
    const lines = [];
    if (isItem) {
      const d = itemDetails(pk.itemId);
      lines.push([d.name, rarityColor(d.rarity)]);
      lines.push([`${d.rarity}${d.kind === 'active' ? ' active item' : ''}${d.tags.length ? `  -  ${d.tags.join(' ')}` : ''}`, COLORS.dim]);
      lines.push([d.desc, COLORS.text]);
      // Effect lines that add detail beyond the one-line description.
      // The one-line description covers simple items; list effects when there are several.
      if (d.effects.length >= 2) for (const e of d.effects.slice(0, 4)) lines.push([`- ${e}`, COLORS.copper]);
      const fresh = wouldActivate(p.items || [], pk.itemId);
      if (fresh.length) lines.push([`COMPLETES SYNERGY: ${fresh.map((x) => x.name).join(', ')}!`, COLORS.cyan]);
      else if (d.synergies.length) {
        const sy = d.synergies[0];
        lines.push([`Synergy: ${sy.synergy.name} (with ${sy.partners.join(' + ')})`, 0x5a9aa8]);
      }
    } else {
      const c = CONSUMABLE_MAP[pk.consId];
      lines.push([c?.name || '?', COLORS.verdigris]);
      lines.push(['consumable  -  single use', COLORS.dim]);
      lines.push([c?.desc || '', COLORS.text]);
    }
    const key = this.scene.inputHint ? this.scene.inputHint('interact') : 'E';
    if (pk.price > 0) lines.push([`[${key}] BUY FOR ${pk.price} COGS${(p.cogs ?? 0) < pk.price ? '  (NOT ENOUGH)' : ''}`, (p.cogs ?? 0) < pk.price ? COLORS.red : COLORS.brass]);
    else if (pk.needInteract || (isItem && ITEM_MAP[pk.itemId]?.kind === 'active')) lines.push([`[${key}] TAKE${isItem && p.active ? ' (SWAPS YOUR ACTIVE)' : ''}`, COLORS.brass]);
    else lines.push(['WALK OVER IT TO TAKE', COLORS.dim]);

    const W = 176;
    const texts = [];
    let h = 4;
    for (const [str, col] of lines) {
      const t = text(S, 0, h, str, { color: col, maxWidth: W - 10, shadow: false });
      texts.push(t);
      h += t.height + 2;
    }
    h += 2;
    const x = Math.max(W / 2 + 18, Math.min(ROOM_PX_W - W / 2 - 18, pk.x));
    // Prefer above the pedestal; otherwise below; always kept inside the room.
    let y = pk.y > h + 30 ? pk.y - 16 - h : pk.y + 22;
    y = Math.max(18, Math.min(ROOM_PX_H - 18 - h, y));
    const g = S.add.graphics();
    g.fillStyle(0x100c0a, 0.92).fillRect(-W / 2, 0, W, h);
    g.lineStyle(1, 0xc99a2e, 0.9).strokeRect(-W / 2 + 0.5, 0.5, W - 1, h - 1);
    const c = S.add.container(x, y, [g, ...texts.map((t) => t.setX(-W / 2 + 5))]).setDepth(700);
    return c;
  }

  // ------------------------------------------------------------------ zones
  renderZones(view) {
    const S = this.scene;
    this.sync('zones', view.zones, (z) => {
      const o = { parts: [] };
      if (z.type === 'cloud') {
        const n = z.r > 12 ? 4 : 1;
        o.puffs = [];
        for (let i = 0; i < n; i++) {
          const img = S.add.image(z.x, z.y, 'puff').setDepth(350);
          img.ox = (Math.random() - 0.5) * z.r;
          img.oy = (Math.random() - 0.5) * z.r * 0.7;
          img.spin = (Math.random() - 0.5) * 2;
          o.puffs.push(img);
        }
      } else if (z.type === 'fire') {
        o.puffs = [];
        for (let i = 0; i < 3; i++) {
          const img = S.add.image(z.x, z.y, 'puff').setDepth(45).setBlendMode('ADD').setTint(0xff7a1f);
          img.ox = (Math.random() - 0.5) * z.r;
          img.oy = (Math.random() - 0.5) * z.r * 0.6;
          o.puffs.push(img);
        }
        o.glow = S.add.image(z.x, z.y, 'glow').setDepth(44).setBlendMode('ADD').setTint(0xff5a1f).setScale(z.r / 24);
      } else if (z.type === 'oil') {
        o.spr = S.add.ellipse(z.x, z.y, z.r * 2, z.r * 1.3, 0x0a0806, 0.75).setDepth(4);
      } else if (z.type === 'vent') {
        o.spr = S.add.image(z.x, z.y, 'vent').setDepth(3).setScale(ART);
        o.ring = S.add.image(z.x, z.y, 'circle16').setDepth(5).setTint(0xff4040).setScale((z.r * 2) / 32);
      } else if (z.type === 'telegraph') {
        o.fill = S.add.image(z.x, z.y, 'glow').setDepth(6).setTint(0xff2020).setBlendMode('ADD');
        o.ring = S.add.image(z.x, z.y, 'circle16').setDepth(6).setTint(0xff4040).setScale((z.r * 2) / 32);
        o.gear = S.add.image(z.x, z.y - 120, 'cog5').setDepth(640).setScale((z.r / 8) * ART).setTint(0x8a8178);
      } else if (z.type === 'beam') {
        o.g = S.add.graphics().setDepth(430);
      }
      return o;
    }, (o, z) => {
      const lf = Math.max(0, Math.min(1, lifeFrac(z)));
      if (z.type === 'cloud') {
        for (const img of o.puffs) {
          img.rotation += img.spin * 0.02;
          img.setPosition(z.x + img.ox, z.y + img.oy).setScale((z.r / 5) * (0.6 + (1 - lf) * 0.4));
          img.setAlpha(Math.min(0.55, lf * 1.5) * (z.team === 'player' ? 1 : 0.9));
          img.setTint(z.electrified ? (Math.random() < 0.2 ? 0xffffff : 0x9fefff) : z.team === 'player' ? 0xe6e9e4 : 0xb8c8a0);
        }
        if (z.electrified && Math.random() < 0.12) this.fx.electric.explode(2, z.x + (Math.random() - 0.5) * z.r, z.y + (Math.random() - 0.5) * z.r);
      } else if (z.type === 'fire') {
        for (const img of o.puffs) {
          img.setPosition(z.x + img.ox + (Math.random() - 0.5), z.y + img.oy).setScale((z.r / 6) * (0.8 + Math.random() * 0.3)).setAlpha(Math.min(0.9, lf * 2));
          img.setTint(Math.random() < 0.5 ? 0xff7a1f : 0xffb347);
        }
        o.glow.setAlpha(Math.min(0.6, lf * 1.5));
        if (Math.random() < 0.3) this.fx.ember.explode(1, z.x + (Math.random() - 0.5) * z.r, z.y);
      } else if (z.type === 'oil') {
        o.spr.setAlpha(Math.min(0.75, lf * 2));
      } else if (z.type === 'vent') {
        o.ring.setVisible(z.state === 1).setAlpha(0.4 + Math.sin(this.time * 30) * 0.4);
        if (z.state === 1 && Math.random() < 0.3) this.fx.steam.explode(1, z.x, z.y);
        if (z.state === 2 && Math.random() < 0.8) this.fx.steam.explode(2, z.x + (Math.random() - 0.5) * z.r, z.y - Math.random() * 6);
      } else if (z.type === 'telegraph') {
        const k = Math.min(1, z.t / Math.max(0.01, z.delay));
        o.fill.setScale((z.r / 26) * k).setAlpha(0.25 + k * 0.5);
        o.ring.setAlpha(0.5 + Math.sin(this.time * 25) * 0.3);
        o.gear.setPosition(z.x, z.y - (1 - k) * 120).setRotation(this.time * 6).setAlpha(k).setVisible(!z.fired);
      } else if (z.type === 'beam') {
        const g = o.g;
        g.clear();
        const active = z.t >= z.warn;
        if (!active) {
          g.lineStyle(1, 0xff4040, 0.4 + Math.sin(this.time * 40) * 0.4);
          g.lineBetween(z.x, z.y, z.x2, z.y2);
        } else {
          g.lineStyle(z.width + 4, 0x2a8aff, 0.35);
          g.lineBetween(z.x, z.y, z.x2, z.y2);
          g.lineStyle(z.width, 0x9fefff, 0.9);
          g.lineBetween(z.x, z.y, z.x2, z.y2);
          g.lineStyle(2, 0xffffff, 1);
          g.lineBetween(z.x, z.y, z.x2, z.y2);
        }
      }
    });
  }

  // ------------------------------------------------------------------ allies & pings
  renderAllies(view) {
    const S = this.scene;
    this.sync('allies', view.allies, (a) => {
      const key = a.type === 'orbital' ? 'cog5' : a.type === 'owl' ? 'item_clockwork_owl' : 'item_brass_turret';
      const o = { spr: S.add.image(a.x, a.y, key).setScale(ART) };
      if (a.type === 'orbital') o.spr.setTint(a.small ? 0xffd08a : 0xe39a63).setScale((a.small ? 0.6 : 0.9) * ART);
      return o;
    }, (o, a) => {
      o.spr.setPosition(a.x, a.y).setDepth(100 + a.y + 2);
      if (a.type === 'orbital') o.spr.setRotation(this.time * 10);
      if (a.type === 'owl') o.spr.setFlipX(Math.cos(a.ang) < 0).setY(a.y + Math.sin(this.time * 6) * 1.5);
    });
  }

  renderPings(view) {
    const S = this.scene;
    this.sync('pings', view.pings, (q) => {
      const slot = view.players.find((p) => p.id === q.pid)?.slot ?? 0;
      const c = PLAYER_COLORS[slot % 4];
      this.fx.ring(q.x, q.y, 14, c, 400);
      return { spr: S.add.image(q.x, q.y, 'pingfx').setDepth(650).setTint(c).setScale(ART), arrow: text(S, q.x, q.y - 10, 'V', { origin: [0.5, 1], color: c, depth: 650 }) };
    }, (o, q) => {
      o.spr.setPosition(q.x, q.y).setScale(ART * (1 + Math.sin(this.time * 8) * 0.15)).setAlpha(Math.min(1, q.t));
      o.arrow.setPosition(q.x, q.y - 9 + Math.sin(this.time * 8) * 2).setAlpha(Math.min(1, q.t));
    });
  }

  flashPlayer(id) {
    this.hurtFlash.set(id, this.time + 0.12);
  }

  destroy() {
    for (const m of Object.values(this.maps)) {
      for (const s of m.values()) this.destroyObj(s);
      m.clear();
    }
  }
}
