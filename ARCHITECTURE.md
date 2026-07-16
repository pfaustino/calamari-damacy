# Architecture

## State machine

`title` → `playing` ⇄ `paused` → `result` → (`playing` | `title`)

Owned by `src/game/Game.js` (orchestrator only).

## Modules

| Module | Role |
|--------|------|
| `Game.js` | State, loop, wiring |
| `Katamari.js` | Ball motion, growth, sticking |
| `Collectibles.js` | Spawn + pickup tests |
| `World.js` | Floor, lights, fog |
| `FollowCamera.js` | Third-person follow + wish→world |
| `Input.js` | Keyboard |
| `UI.js` | HUD / overlays |
| `rng.js` | Seeded Mulberry32 |

## Data

- `data/game.json` — accel, max speed, pickup ratio, camera  
- `data/stage.json` — timer, goal cm, floor, spawn count, seed  
- `data/objects.json` — pickup types (size, mass, color, weight)  

## Constants that must stay aligned

- Display size: `diameterCm = round(radius * 20)` (1 world unit radius ≈ 10 cm radius / 20 cm diameter)  
- Pickup: `object.size < radius * tuning.pickupRatio`  
- Scoop → melt: growth is deferred via `growthLeft` and applied as `melt` goes 0→1; protrusions add `protrusionInertia` + `scrapeFriction` until melted  
