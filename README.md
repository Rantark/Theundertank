# The Undercrank

A fast, top-down, pixel-art roguelike twin-stick shooter with couch and online co-op.

At the centre of a warm, bustling steampunk city lies **the Undercrank**: a living clockwork
dungeon whose gears rearrange every time someone descends. Spend Cogs in town on permanent
upgrades, dive into an endless series of floors, stack items into absurd synergies, die, and
come back stronger.

All art is generated procedurally in code (16×16 sprites, 32×32 bosses, a 5×7 bitmap font),
and every sound effect and music track is synthesised with the Web Audio API. There are no
asset files.

---

## Quick start

Requires **Node.js 18+** (tested on Node 22).

```bash
npm install
npm run dev
```

`npm run dev` starts two processes:

| Process | URL | Purpose |
|---|---|---|
| Vite dev server (client) | http://localhost:5173 | Open this in your browser to play |
| Socket.IO game server | http://localhost:3001 | Online co-op (the dev client proxies `/socket.io` to it) |

Solo and couch co-op run entirely in the browser; the server is only needed for online play.

Other scripts:

```bash
npm test             # headless simulation tests (floors, synergies, every boss pattern, items, co-op)
npm run build        # production build of the client into client/dist
npm start            # run the server; it also serves client/dist when it exists
npm run dev:client   # client only
npm run dev:server   # server only (auto-restarts on change)
```

### Hosting on a Raspberry Pi (or any single machine)

```bash
npm ci
npm run build
PORT=3001 npm start
```

Then everyone opens `http://<pi-address>:3001`. The server serves the built client and runs
the authoritative simulation. One busy room with four players costs about 0.2 ms per tick on a
desktop CPU (~4 KB snapshots at 15 Hz), so a Pi comfortably hosts several rooms.

Environment variables: `PORT` (default 3001) and `DEFLATE=1` (enables WebSocket compression:
less bandwidth, more CPU).

---

## Controls

| Action | Keyboard + mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Aim / shoot | Mouse + left click, **or** arrow keys (aim and fire) | Right stick (auto-fires), or RT |
| Dash (i-frames) | Space / Shift / right click | A / LT / RB |
| Active item | Q | Y |
| Consumable | F | LB / B |
| Interact / buy / use the hatch | E | X |
| Ping a location | C / middle click | D-pad up / R3 |
| Pause (items and synergies) | Esc / P / Tab | Start / Back |

Menus accept arrows, WASD, Enter/Space/E and Escape, or the d-pad/stick with A and B.

---

## How to play

1. **Title** — whoever presses a key or button first becomes Player 1.
2. **Town** — walk the plaza. Talk to the four NPCs to buy permanent upgrades with Cogs:
   - **Tinkerer**: dash charges, move speed, dash recharge, active-item recharge
   - **Gunsmith**: damage, fire rate, shot speed and range, critical hits
   - **Alchemist**: max HP, a free Health Tonic each run, better heart drops, a longer co-op revive window
   - **Clockmaker**: luck, a Cog magnet, a random starting item, and **character unlocks and selection**
   Costs escalate with every level you buy.
3. **Descend** — interact with the great gear-ringed shaft in the middle of town.
4. **The dungeon** — clear combat rooms to unlock the doors. Find treasure rooms, shops
   (Cogs buy run items here too), rest benches, challenge levers, and secret rooms hidden
   behind cracked walls (shoot them or blow them up). Clearing the exit room opens a hatch
   to the next floor. Every **5th floor** is a boss floor.
5. **Death** — the run summary shows kills, damage, items and synergies. Every Cog you
   collected is banked, so you return to town stronger.

The dungeon is **endless**: enemy HP, damage, density, projectile speed and elite chance keep
scaling; new enemy types unlock at deeper tiers, and floors roll modifiers such as
*Overpressure* (erupting vents), *Gaslight Failure* (darkness), *Volatile Cores* and
*Gear Storm*. Bosses gain new patterns and modifiers (reinforced, summoner, enraged,
overcharged) on each deeper boss floor.

### Couch co-op (up to 4)

In town, press **Start/A** on another gamepad (or **Enter** on the keyboard if a pad is
Player 1) to join. **Back/Select** leaves. Each player has their own character (choose at the
Clockmaker with that player's controller), HP and inventory. Item, heart and Cog pickups are
**instanced per player**, so there are no loot fights. Downed players can be revived by a
teammate standing next to them before their timer runs out; anyone who falls for good
rejoins on the next floor. Difficulty scales with player count.

### Online co-op (up to 4)

1. Choose **Online Co-op** on the title screen.
2. Set your name. Leave **Server** empty to use the machine serving the page, or type
   `host:port` (for example `192.168.1.20:3001`).
3. One player picks **Create room** and shares the 4-letter code. The others use **Join room**
   (type the code, or use the gamepad letter picker).
4. Everyone lands in their own town (upgrades come from each player's own save). Interact with
   the gate to **ready up**; the run starts when everyone is ready.

---

## Architecture

```
/shared   deterministic game logic, used by BOTH the browser and the server
  src/data/        items, synergies, enemies, bosses, room templates, modifiers, upgrades, characters
  src/sim/         the simulation (no rendering)
    game.js        Game: rooms, combat API, loot, co-op, floor progression, events
    floorgen.js    seeded floor generation from room templates
    stats.js       loadout pipeline: base -> character -> upgrades -> items -> synergies
    behaviors.js   composable projectile behaviours (homing, split, chain, burn, explode...)
    actions.js     named effects used by item hooks, active items and consumables
    projectiles.js, zones.js, allies.js, enemies.js, bosses.js, loot.js, player.js
    snapshot.js    compact network encoding/decoding of the dynamic state
  src/rng.js       seeded RNG (mulberry32) with fork()
/client   Phaser 3 + Vite
  src/gfx/         procedural sprites (pix.js, sprites.js, icons.js), font, room + world renderers, FX
  src/scenes/      Boot, Title, Town, Shop, Game, Hud, Pause, Summary, Online
  src/net/         LocalSession (in-browser sim), NetClient/NetSession (online), prediction
  src/input/       keyboard/mouse + Gamepad API, device-to-player slots
  src/audio/       Web Audio synthesiser and procedural music
/server   Node + Socket.IO authoritative host
```

**One simulation, two hosts.** `Game` in `/shared` is the only gameplay code. Solo and couch
co-op run it in the browser at a fixed 60 Hz step (`LocalSession`). Online, the server runs the
same class at 30 Hz per room; clients only send inputs and render.

**Rendering is decoupled.** The sim never touches Phaser; it emits events (`fire`, `hit`,
`kill`, `shake`, `hitstop`, `fx`, `bolt`, `synergy`, ...) that the client turns into particles,
screen shake, hit-stop, sound and HUD toasts. The renderer reads entity lists with the same
field names whether they come from a local `Game` or a decoded network snapshot.

**Networking.** The shared seed means clients regenerate every floor layout locally; only
dynamic state is sent (players, enemies, projectiles, pickups, zones, room flags, events).
Clients render about 120 ms behind the server and interpolate by entity id. The local player's
movement is predicted from local input, replaying inputs the server hasn't acknowledged, and
smoothly reconciled. Button presses are sent as ever-increasing counters, so no press is lost
between ticks.

**Readability.** Player shots are small, bright and outline-free (brass, fire, electric);
enemy shots are larger magenta rings with a pale core and a dark outline, so they read
against any floor.

---

## Adding content (data only)

### Items — `shared/src/data/items.js`

```js
{ id: 'frost_valve', name: 'Frost Valve', rarity: 'rare', tags: ['CLOCKWORK'],
  desc: 'Shots slow enemies; +10% damage.',
  stats: { damage: { mult: 1.1 } },                 // additive (add) then multiplicative (mult)
  proj:  { slow: { amount: 0.4, duration: 1.2 } },  // projectile behaviours (behaviors.js)
  hooks: [{ on: 'kill', action: 'cloud', chance: 0.3, params: { radius: 18, dps: 10, life: 2 } }],
  allies: [{ type: 'orbital', radius: 24, speed: 3, damage: 10 }],
  flags: { someFlag: 1 },                           // read by generic systems
}
```

- `stats` keys: see `BASE_STATS` in `data/characters.js`.
- `proj` behaviours: `homing`, `wave`, `accel`, `spiral`, `grow`, `steamTrail`, `burn`, `slow`,
  `chain`, `explode`, `split`, `burst`, `lob`. Params from several items are **merged** (summed,
  or max/min for ranges and intervals), so items stack without special cases, and split shards
  inherit every other behaviour of their parent.
- `hooks[].on`: `fire`, `hit`, `kill`, `dash`, `hurt`, `roomClear`, `floor`, `tick`.
- `hooks[].action` / `active.action`: any key of `ACTIONS` in `sim/actions.js`.
- Active items: `kind: 'active'` and `active: { action, params, charge /* seconds */ }`.
- Rarity: `common`, `rare`, `legendary`, `cursed` (cursed items trade power for a drawback).
- Add an icon drawer in `client/src/gfx/icons.js` (optional: a fallback icon uses the item's first tag).

### Synergies — `shared/src/data/synergies.js`

```js
{ id: 'storm_front', name: 'Storm Front', desc: '...',
  requires: { items: ['tesla_coil', 'steam_canister'] },   // and/or { tags: { STEAM: 3 } }
  flags: { cloudsElectrified: 1 } }                        // same payload schema as items
```

A toast announces a synergy the moment it activates. There are 47 items, 6 consumables and
14 synergies.

### Enemies — `shared/src/data/enemies.js`

Pick an `ai` from `AI` in `sim/enemies.js` (`chaser`, `turret`, `kiter`, `bomber`, `hopper`,
`bouncer`, `burrower`, `shielded`, `teleporter`, `summoner`, `sprayer`), tune `params`, and set
`minDepth` and `weight`. Add a drawer in `ENEMY_DRAW` (`client/src/gfx/sprites.js`).

### Bosses — `shared/src/data/bosses.js`

List patterns from `PATTERNS` in `sim/bosses.js` with weights, an optional `minTier` (boss-floor
tier = depth / 5) and an optional `phase: 2` (below 50% HP). Movement: `chase`, `center`, `prowl`
or `float`.

### Rooms — `shared/src/data/rooms.js`

21×11 ASCII templates: `.` floor, `#`/`c` blocks, `o` pits, `v` steam vents, `e` spawn hints,
`P` feature anchor. Keep the middle row and column clear near the edges for doors. Templates
are mirrored randomly.

---

## Content summary

- **5 characters**: Tinker, Stoker, Courier, Artificer, Soot Widow
- **11 enemy types** plus elite variants (hasted, armoured, volatile, splitting)
- **4 bosses** with 6 patterns each: Steam Golem, Clocktower Automaton, Boiler-Hearted Beast, Tesla Matriarch
- **47 items** (41 passive, 6 active), **6 consumables**, **14 named synergies**
- **7 floor modifiers**, **23 room templates**, 7 room types (combat, treasure, shop, secret, challenge, rest, boss) plus start and exit
- **15 permanent upgrades** across 4 shops
