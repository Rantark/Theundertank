// Item / consumable icon drawers (14x14 and 12x12). Many items share a base shape
// recoloured by their dominant tag so the art stays consistent and cheap to extend.
import { PAL } from '@undercrank/shared';

const K = PAL.soot;
const TAG_COLOR = {
  FIRE: 0xff6a1f, STEAM: 0xe6e9e4, ELECTRIC: 0x6ff0ff, PIERCING: 0xd9d2c3, HOMING: 0x8fd14f, SPLIT: 0xf2cf6b,
  ORBITAL: 0xe39a63, EXPLOSIVE: 0xe0303a, CLOCKWORK: 0xc99a2e, SPEED: 0x4fc3d9, BOUNCE: 0xe0588a,
};
const tagColor = (it) => (it && it.tags && it.tags.length ? TAG_COLOR[it.tags[0]] : PAL.brass);

const barrel = (p, c = PAL.brass, c2 = PAL.brassLight) => p.rect(1, 5, 11, 4, c).rect(1, 5, 11, 1, c2).rect(11, 4, 2, 6, PAL.brassDark).rect(2, 8, 3, 4, PAL.copperDark);
const gear = (p, c = PAL.brass, d = PAL.brassDark, r = 4.5) => p.gear(7, 7, r, 8, c, d, 1.5);
const flask = (p, liquid) => p.rect(5, 1, 4, 3, PAL.steam).disc(7, 9, 4.5, 0x9ac8c8).disc(7, 10, 3.5, liquid).px(5, 8, 0xffffff);
const coil = (p, c = PAL.copper) => {
  p.rect(6, 1, 2, 12, PAL.iron);
  for (let y = 3; y < 12; y += 2) p.line(3, y, 10, y + 1, c);
  p.disc(7, 2, 2, PAL.electric);
};
const orb = (p, c, core = 0xffffff) => p.disc(7, 7, 5, c).disc(6, 6, 2, core);

export const ITEM_ICON = {
  _default: (p, it) => gear(p, tagColor(it)),
  brass_barrel: (p) => barrel(p),
  greased_gears: (p) => { gear(p); p.gear(10, 10, 2.5, 6, PAL.copper, PAL.copperDark); p.px(3, 3, 0x2a2a2a).px(4, 2, 0x2a2a2a); },
  spring_boots: (p) => { p.rect(3, 2, 5, 6, PAL.copper).rect(3, 8, 8, 3, PAL.copperDark); for (let y = 11; y < 14; y++) p.line(3, y, 10, y, PAL.ironLight); },
  copper_plating: (p) => p.rect(2, 2, 10, 10, PAL.copper).rect(2, 2, 10, 2, PAL.copperLight).px(3, 5, PAL.brassLight).px(10, 5, PAL.brassLight).px(3, 10, PAL.brassLight).px(10, 10, PAL.brassLight),
  rifled_barrel: (p) => { barrel(p, PAL.ironLight, 0xb0a898); p.line(2, 6, 11, 7, PAL.iron); },
  coal_furnace: (p) => p.rect(2, 4, 10, 9, PAL.iron).rect(4, 7, 6, 4, 0x2a1810).rect(5, 8, 4, 3, 0xff6a1f).px(6, 8, 0xffd08a).rect(9, 0, 2, 4, PAL.ironLight),
  rubber_seals: (p) => p.ring(7, 7, 5, 0x2a2a2a, 2).ring(7, 7, 3, 0xe0588a, 1),
  steam_canister: (p) => p.rect(4, 2, 6, 11, PAL.ironLight).rect(4, 2, 6, 2, PAL.steam).disc(7, 8, 2, 0xe8e0c8).line(7, 8, 8, 7, K),
  gyro_sight: (p) => p.ring(7, 7, 5, PAL.brass, 1).line(7, 1, 7, 13, PAL.brassLight).line(1, 7, 13, 7, PAL.brassLight).px(7, 7, 0xe0303a),
  pressure_valve: (p) => p.rect(1, 9, 12, 3, PAL.copper).rect(6, 4, 2, 6, PAL.iron).disc(7, 3, 3, 0xe0303a).disc(7, 3, 1, PAL.brassLight),
  lucky_cog: (p) => { gear(p, 0x8fd14f, 0x3f7a2a); p.px(7, 7, 0xffffff); },
  oil_can: (p) => p.rect(3, 5, 7, 8, 0x3a3a3a).line(9, 6, 13, 2, PAL.brass).rect(4, 3, 4, 2, PAL.brass).px(4, 6, 0x6a6a6a),
  spark_plug: (p) => p.rect(5, 1, 4, 5, 0xe8e0c8).rect(4, 6, 6, 3, PAL.ironLight).rect(6, 9, 2, 3, PAL.iron).line(7, 12, 9, 13, PAL.electric),
  sturdy_gasket: (p) => p.ring(7, 7, 5.5, PAL.brass, 2).ring(7, 7, 2, PAL.steam, 1),
  tesla_coil: (p) => coil(p),
  split_barrel: (p) => { barrel(p); p.line(12, 7, 13, 4, PAL.brassLight).line(12, 7, 13, 10, PAL.brassLight); },
  homing_gyroscope: (p) => p.ring(7, 7, 5, PAL.verdigris, 1).ellipse(7, 7, 5, 2, PAL.verdigrisLight).disc(7, 7, 1.5, 0xe0303a),
  overclocked_gears: (p) => { gear(p, 0xff9c3a, 0x8a3a10); p.px(3, 1, 0xffd08a).px(11, 2, 0xffd08a); },
  blast_cap: (p) => p.disc(7, 8, 4.5, 0x2e2a28).rect(6, 1, 2, 4, PAL.copperDark).px(7, 0, 0xff9c3a).px(5, 6, 0x6a6a6a),
  orbiting_cog: (p) => { p.ring(7, 7, 6, PAL.ironLight, 1); p.gear(11, 4, 2.5, 6, PAL.copperLight, PAL.copperDark); p.disc(7, 7, 2, 0xe8b48a); },
  twin_barrels: (p) => p.rect(1, 3, 11, 3, PAL.brass).rect(1, 8, 11, 3, PAL.brass).rect(1, 3, 11, 1, PAL.brassLight).rect(1, 8, 11, 1, PAL.brassLight).rect(3, 5, 3, 7, PAL.copperDark),
  magnetic_coil: (p) => p.rect(2, 2, 3, 10, 0xe0303a).rect(9, 2, 3, 10, PAL.ironLight).rect(2, 9, 10, 3, PAL.iron).rect(2, 2, 3, 3, 0xffffff).rect(9, 2, 3, 3, 0xffffff),
  kinetic_dynamo: (p) => { p.disc(7, 7, 5, PAL.iron); p.gear(7, 7, 3, 6, PAL.electric, 0x2a6a7a); },
  vent_shroud: (p) => { p.rect(2, 5, 10, 7, PAL.ironLight); for (let x = 3; x < 12; x += 2) p.rect(x, 6, 1, 5, PAL.iron); p.disc(5, 2, 2, PAL.steam).disc(9, 2, 2, PAL.steam); },
  clockwork_owl: (p) => p.ellipse(7, 8, 5, 5, PAL.brass).disc(5, 6, 1.8, 0xe8e0c8).disc(9, 6, 1.8, 0xe8e0c8).px(5, 6, K).px(9, 6, K).px(7, 8, PAL.copper).line(3, 1, 5, 3, PAL.brassDark).line(11, 1, 9, 3, PAL.brassDark),
  powder_keg: (p) => p.rect(3, 3, 8, 10, PAL.copperDark).rect(2, 5, 10, 2, PAL.iron).rect(2, 10, 10, 2, PAL.iron).rect(5, 1, 3, 2, 0xe0303a),
  chrono_spring: (p) => { for (let i = 0; i < 5; i++) p.ring(7, 7, 1.5 + i, i % 2 ? PAL.brass : PAL.brassLight, 1); },
  oscillator: (p) => { for (let x = 1; x < 13; x++) p.px(x, 7 + Math.round(Math.sin(x * 0.9) * 4), PAL.electric).px(x, 8 + Math.round(Math.sin(x * 0.9) * 4), 0x2a8a9a); },
  scalding_rounds: (p) => { p.disc(9, 9, 3, 0xffc93c); p.disc(4, 5, 2.5, PAL.steam).disc(6, 3, 2, PAL.steam); },
  engine_heart: (p) => { p.disc(5, 6, 3.5, 0xe0303a).disc(9, 6, 3.5, 0xe0303a).rect(3, 7, 9, 3, 0xe0303a); p.gear(7, 7, 2.5, 6, PAL.brassLight, PAL.brassDark); p.px(7, 12, 0xe0303a); },
  storm_lens: (p) => p.disc(7, 7, 5.5, PAL.brass).disc(7, 7, 4, 0x9fe8ff).line(5, 3, 8, 7, 0xffffff).line(8, 7, 6, 11, 0xffffff),
  swarm_hive: (p) => p.ellipse(7, 8, 5, 5, PAL.copper).line(2, 6, 12, 6, PAL.copperDark).line(2, 10, 12, 10, PAL.copperDark).disc(7, 8, 1.5, K).px(3, 2, PAL.brassLight).px(11, 3, PAL.brassLight).px(12, 12, PAL.brassLight),
  dragon_boiler: (p) => p.rect(2, 4, 9, 9, 0x5a2a1a).rect(3, 6, 7, 4, 0xff6a1f).px(4, 7, 0xffd08a).px(7, 7, 0xffd08a).rect(10, 5, 3, 3, PAL.brass).rect(2, 2, 3, 2, 0x5a2a1a),
  quad_gatling: (p) => { for (let i = 0; i < 4; i++) p.rect(1, 2 + i * 3, 10, 2, i % 2 ? PAL.brass : PAL.brassLight); p.rect(9, 1, 4, 12, PAL.iron); },
  aether_compass: (p) => p.disc(7, 7, 5.5, PAL.brass).disc(7, 7, 4.5, 0xe8e0c8).line(7, 3, 7, 7, 0xe0303a).line(7, 7, 7, 11, PAL.iron).px(7, 7, K),
  cracked_boiler: (p) => p.rect(3, 2, 8, 11, 0x5a3a2a).line(5, 2, 8, 7, K).line(8, 7, 6, 12, K).rect(4, 7, 2, 2, 0xff6a1f),
  blood_oil: (p) => { p.rect(5, 1, 4, 3, PAL.iron); p.disc(7, 9, 4.5, 0x5a0a1a).disc(6, 8, 1.5, 0xb03040); },
  leaden_gears: (p) => gear(p, 0x5a5a60, 0x2a2a30),
  soot_lung: (p) => p.ellipse(4, 8, 3, 5, 0x3a3030).ellipse(10, 8, 3, 5, 0x3a3030).rect(6, 1, 2, 5, PAL.ironLight).px(3, 7, 0xb03fd9).px(10, 9, 0xb03fd9),
  gamblers_cog: (p) => p.rect(3, 3, 8, 8, 0xe8e0c8).px(5, 5, K).px(9, 9, K).px(7, 7, K).px(5, 9, 0xb03fd9).px(9, 5, 0xb03fd9),
  hungry_engine: (p) => { p.rect(2, 4, 10, 8, PAL.iron); p.rect(3, 7, 8, 3, K); for (let x = 3; x < 11; x += 2) p.px(x, 7, PAL.steam).px(x + 1, 9, PAL.steam); p.px(4, 5, 0xb03fd9).px(9, 5, 0xb03fd9); },
  steam_whistle: (p) => p.rect(5, 4, 4, 9, PAL.brass).rect(5, 4, 1, 9, PAL.brassLight).rect(4, 12, 6, 2, PAL.brassDark).disc(4, 2, 2, PAL.steam).disc(9, 1, 1.5, PAL.steam),
  pocket_watch: (p) => p.disc(7, 8, 5, PAL.brass).disc(7, 8, 4, 0xe8e0c8).line(7, 8, 7, 5, K).line(7, 8, 9, 9, K).rect(6, 1, 2, 2, PAL.brassLight),
  tesla_bomb: (p) => { p.disc(7, 8, 4.5, 0x2c3f4b); p.line(5, 6, 8, 9, PAL.electric).line(8, 9, 7, 11, PAL.electric); p.rect(6, 1, 2, 3, PAL.copper); },
  brass_turret: (p) => p.rect(3, 8, 8, 5, PAL.iron).disc(7, 7, 3.5, PAL.brass).rect(8, 6, 5, 2, PAL.ironLight),
  repair_kit: (p) => p.rect(2, 4, 10, 8, 0x8a2a2a).rect(6, 5, 2, 6, 0xffffff).rect(4, 7, 6, 2, 0xffffff).rect(5, 2, 4, 2, PAL.iron),
  overdrive_lever: (p) => p.rect(2, 9, 10, 4, PAL.iron).line(7, 9, 11, 2, PAL.ironLight).disc(11, 2, 2, 0xffc93c),
  // consumables
  cons_tonic: (p) => flask(p, 0xe0303a),
  cons_grenade: (p) => p.disc(6, 7, 4, 0x4a5a3a).rect(5, 1, 3, 3, PAL.brass).line(8, 2, 10, 1, PAL.ironLight),
  cons_smoke_bomb: (p) => p.disc(6, 7, 4, 0x8a8a8a).disc(4, 5, 1.5, 0xcccccc).rect(5, 1, 2, 2, PAL.copperDark),
  cons_oil_flask: (p) => flask(p, 0x2a2420),
  cons_cog_magnet: (p) => p.rect(1, 2, 3, 8, 0xe0303a).rect(8, 2, 3, 8, PAL.ironLight).rect(1, 8, 10, 3, PAL.iron).rect(1, 2, 3, 2, 0xffffff).rect(8, 2, 3, 2, 0xffffff),
  cons_surveyor_map: (p) => p.rect(1, 2, 10, 8, 0xe8d8b0).rect(1, 2, 10, 1, 0xc8b890).line(3, 5, 6, 5, PAL.copperDark).line(6, 5, 6, 8, PAL.copperDark).px(8, 4, 0xe0303a),
};
