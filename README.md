# Calamari Damacy

A browser-based **Katamari Damacy**-inspired roller. Stick objects to your growing calamari ball, hit the size goal before time runs out.

**Play:** [pfaustino.github.io/calamari-damacy](https://pfaustino.github.io/calamari-damacy/)

## Play locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 — click **Start Rolling**, then WASD / arrows to roll.

## Core loop

1. Start small on the tide-pool floor  
2. Roll into anything **smaller than you** — it sticks and you grow  
3. Reach the stage size goal before the timer hits zero  

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
- Multi-stage campaign / King of All Cosmos cutscenes  
- Networked multiplayer  
- Physics engine (simple kinematic roll only)  
