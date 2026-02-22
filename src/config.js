'use strict';

// All game constants in one place
const COLS = 100;
const ROWS = 75;
const CELL = 10; // pixels per cell

const CONFIG = Object.freeze({
  COLS,
  ROWS,
  CELL,
  CANVAS_W: COLS * CELL,  // 1000
  CANVAS_H: ROWS * CELL,  // 750

  // Simulation speed
  TICKS_PER_FRAME: 3,
  SPEED_LEVELS: [1, 2, 4, 8], // multipliers for TICKS_PER_FRAME

  // Player controls
  SMOOTH_TURN_RATE: 0.28,     // fraction per tick how fast player ant turns toward target
  ANT_PICK_RADIUS:  2.5,      // cells — click radius for selecting a friendly ant

  // Pheromones
  PHERO_DEPOSIT: 90,
  PHERO_DECAY: 0.9988,
  PHERO_MAX: 255,
  PHERO_SENSE_DIST: 4,    // cells ahead to sample
  PHERO_SENSE_ANG: 0.75,  // radians offset for side sensors

  // Ant movement
  SPEED: 0.075,           // cells per tick
  PLAYER_SPEED: 0.15,
  TURN_MAX: 0.45,         // max steer adjustment per tick (radians)
  WANDER: 0.55,           // randomness: probability of ignoring pheromones

  // Ant stats
  WORKER_HP: 3,
  SOLDIER_HP: 9,
  QUEEN_HP: 25,
  DAMAGE: 1,
  FIGHT_RANGE: 1.2,       // cells — how close to start hitting
  FIGHT_COOLDOWN: 22,     // ticks between hits
  DETECT_RANGE: 8,        // cells — how far ants "see" enemies

  // Colony
  START_WORKERS: 12,
  START_SOLDIERS: 3,
  START_FOOD: 200,
  MAX_POP: 150,
  LAY_COST: 15,           // food per egg
  LAY_INTERVAL: 110,      // ticks between eggs
  EGG_TICKS: 320,
  LARVA_TICKS: 420,
  PUPA_TICKS: 260,

  // World generation
  FOOD_CLUSTERS: 13,
  FOOD_RADIUS: 3,
  FOOD_PER_CELL: 10,
  NEST_R: 3,

  // Alarm pheromone (faster decay; channels 2 & 3 in PheromoneGrid)
  ALARM_DEPOSIT:    200,
  ALARM_DECAY:      0.982,      // much faster than food trail (0.9988)
  ALARM_MAX:        255,
  ALARM_SENSE_DIST: 7,          // cells ahead when sniffing alarm signal

  // Fog of war — cells revealed around each black-colony ant per frame
  EXPLORE_RADIUS: 4,

  // Colony economy dashboard
  HISTORY_INTERVAL: 60,         // ticks between population / food-rate samples
  HISTORY_LENGTH:   80,         // number of samples kept for sparkline
});
