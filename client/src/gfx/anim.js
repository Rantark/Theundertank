// Animation helpers shared by the dungeon and town renderers.
// Characters have front ('down'), back ('up') and side views; side is mirrored for left.

/** Pick a view from a facing angle (radians). */
export function viewFor(angle) {
  const s = Math.sin(angle);
  if (s < -0.62) return { view: 'up', flip: false };
  if (s > 0.62) return { view: 'down', flip: false };
  return { view: 'side', flip: Math.cos(angle) < 0 };
}

/**
 * Texture key + flip for a paper-doll character.
 * @param {string} prefix e.g. 'pl_tinker', 'npc_gunsmith', 'townie_3'
 * @param {number} angle  facing angle
 * @param {boolean} moving
 * @param {number} t      seconds (animation clock)
 * @param {boolean} dashing
 */
export function charFrame(prefix, angle, moving, t, dashing = false, moveAngle = angle) {
  if (dashing) {
    const flip = Math.cos(moveAngle) < 0;
    return { key: `${prefix}_side_dash0`, flip, view: 'side' };
  }
  const { view, flip } = viewFor(angle);
  const pose = moving ? `walk${Math.floor(t * 10) % 4}` : `idle${Math.floor(t * 1.6) % 2}`;
  return { key: `${prefix}_${view}_${pose}`, flip, view };
}

// Characters are 32x64 textures whose feet sit near the bottom; anchor at the hips so the
// simulation position (hitbox centre) lines up with the lower body.
export const CHAR_ORIGIN_Y = 50 / 64;
