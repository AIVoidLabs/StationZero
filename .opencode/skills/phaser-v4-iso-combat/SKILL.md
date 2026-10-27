---
name: phaser-v4-iso-combat
description: Phaser v4 patterns for isometric action - movement, damage, minimal combat
license: MIT
compatibility: opencode
metadata:
  engine: phaser-v4
  genre: isometric-action
---
## Purpose
Patterns for isometric action in Phaser v4 focused on avoidance/combat minimalism (Station Zero VS-07).

## Key Patterns
- **Isometric movement**: convert input to isometric directions or use grid-based movement
- **Depth sorting**: sort sprites by isoY each frame in update or use a dedicated system
- **Collision**: prefer tile/grid checks for tight corridors
- **Camera**: tight follow, avoid floaty movement

## Contextual Targeting
- **Left-click empty ground**: move (click-to-move). No auto-attack
- **Left-click enemy**: approach enemy (MOVING_TO_ATTACK). On reaching attack range, stop and attack (ATTACKING). Must stop to attack
- **Hover/target detection**: use grid/world to determine if target is enemy/walkable
- **Cancel on movement input**: WASD/pathing should cancel attack if player chooses to move

## Weapon States
- `PISTOL` (ammo-based): ranged, requires ammo, right-click fires only when stationary
- `MELEE` (fallback): short range, used when pistol ammo <= 0 or no pistol
- Track `ammo`, `maxAmmo`, `weaponType`, `range`, `damage`, `cooldownMs`

## Right-Click Fire (Pistol)
- **Only** when weapon is PISTOL and `ammo > 0` and player is **stationary**
- Forces stop (cancel movement/path)
- Fires from current position (hitscan preferred)
- LOS required, respect range
- Consumes ammo
- Cannot fire while moving

## Approach-to-Attack
- If target out of range: path/approach
- If target in range: stop movement, enter ATTACKING
- Attack only while stationary

## Stop-to-Attack
- Both melee and pistol (left-click context) require player to be stopped
- Right-click pistol also requires stopped state

## Ammo Fallback
- If `ammo <= 0` and holding/using pistol context, automatically switch to MELEE
- Show `AMMO: MELEE` or `0/max` in HUD

## Ranges
- **Melee (punch/lever)**: short (1.6 - 1.8 grid)
- **Pistol**: medium-long (5 - 6 grid), LOS critical in tight corridors

## Minimal HUD
- Show only **HP + Ammo** (brutalist, analog)
- Update on damage/heal/ammo change
- No inventory, menus, XP, loadouts

## Tips
- Keep update loops lean
- Clean up events on scene shutdown
- Test with tight corridors to catch z-order issues
- Avoid physics-heavy arcade bodies unless necessary
- Prefer hitscan for pistol, short arc/range for melee
- Strict TypeScript, no any
- Respect depth sorting (isoY)
