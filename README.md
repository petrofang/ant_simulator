# Ant Simulator 🐜

A modern browser-based clone of the classic **SimAnt** (Maxis, 1991).

## How to play

Open `index.html` in any modern browser — no build step, no server needed.

```
open index.html          # macOS
xdg-open index.html      # Linux
# or just double-click it in your file manager
```

## Features

| Feature | Description |
|---|---|
| **Two colonies** | Black (yours) vs Red (AI enemy) |
| **Pheromone trails** | Workers deposit food-trail pheromone; others follow it |
| **Colony growth** | Queen lays eggs → larva → pupa → adult worker or soldier |
| **Resource collection** | Workers forage for food scattered across the map |
| **Combat** | Soldiers and workers attack nearby enemies on sight |
| **Win / lose** | Destroy the enemy queen — or defend yours! |

## Controls

| Key | Action |
|---|---|
| `W A S D` / `↑ ← ↓ →` | Move your ant |
| `Click` on canvas | Aim your ant toward that point |
| `Space` | Toggle pheromone trail overlay |
| `P` | Pause / Resume |
| `R` | Restart |

The **yellow-highlighted** ant is your ant. You are a single worker in your colony; the rest act autonomously.

## Project structure

```
ant_simulator/
├── index.html        Entry point
├── style.css         Dark-theme UI styling
└── src/
    ├── config.js     All tunable game constants
    ├── world.js      Tile grid, food clusters, nest regions
    ├── pheromone.js  Pheromone grid with decay & 3-sensor steering
    ├── ant.js        Ant entity — foraging, carrying, fighting states
    ├── colony.js     Colony — queen, egg-laying, food management
    ├── renderer.js   Canvas 2D rendering (world, pheromones, ants)
    ├── ui.js         HUD stat updates
    └── game.js       Main game loop & player input
```

## License

MIT © Petrofang
