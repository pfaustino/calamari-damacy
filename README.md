# Calamari Damacy

A browser-based **Katamari Damacy**-inspired roller. Stick objects to your growing calamari ball, hit the size goal before time runs out.

**Play:** [GitHub Pages](https://pfaustino.github.io/calamari-damacy/) · [itch.io](https://pfaustino.itch.io/calamari-damacy)

## Play locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — click **Start Rolling**, then WASD / arrows to roll.

## Core loop

1. Pick a mission from **The Cosmos** (or Start Rolling)  
2. Roll into junk **small enough for your current size** — it sticks and melts into volume  
3. Hit the size goal before time runs out  
4. **Present to the King** → your calamari becomes a star  
5. Unlock the next stage  

On failure: **Try Again** (same mission).
## Stack

| Layer | Choice |
|-------|--------|
| Bundler | Vite |
| 3D | Three.js |
| Balance | `data/*.json` |
| Quality | smoke-check + Playwright |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local play |
| `npm run check` | Smoke + production build |
| `npm run test:e2e` | Playwright smoke |
| `npm run test:e2e:headed` | Visible e2e |

Dev cheats: open with `?dev=1` (also auto-on in Vite DEV).

## Non-goals (v0.1)

- Dual-stick classic Katamari controls  
- Physics engine (simple kinematic roll only)  

## Multiplayer (MVP)

Title → **Multiplayer**: host a room (share the code) or join. Race to the size goal; bump rivals to steal volume. Host simulates; guests send input (PeerJS). Works across browsers/devices on the same network path PeerJS can connect.
