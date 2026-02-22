'use strict';

// Pheromone channel indices
// 0/1 = food trail (black/red), 2/3 = alarm (black/red)
const PHERO = Object.freeze({ BLACK: 0, RED: 1, ALARM_BLACK: 2, ALARM_RED: 3 });

class PheromoneGrid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    // grids[0/1] = food trails (black/red), grids[2/3] = alarm (black/red)
    this.grids = [
      new Float32Array(n), new Float32Array(n),
      new Float32Array(n), new Float32Array(n),
    ];
  }

  deposit(channel, x, y, amount) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= this.cols || yi < 0 || yi >= this.rows) return;
    const i = yi * this.cols + xi;
    this.grids[channel][i] = Math.min(CONFIG.PHERO_MAX, this.grids[channel][i] + amount);
  }

  get(channel, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= this.cols || yi < 0 || yi >= this.rows) return 0;
    return this.grids[channel][yi * this.cols + xi];
  }

  // Bilinear sample for smooth sensing
  sample(channel, x, y) {
    const fx = Math.floor(x), fy = Math.floor(y);
    const tx = x - fx, ty = y - fy;
    const g = this.grids[channel];
    const c = this.cols, r = this.rows;
    const safe = (px, py) => {
      if (px < 0 || px >= c || py < 0 || py >= r) return 0;
      return g[py * c + px];
    };
    return (1 - tx) * (1 - ty) * safe(fx,     fy)
         + tx       * (1 - ty) * safe(fx + 1, fy)
         + (1 - tx) * ty       * safe(fx,     fy + 1)
         + tx       * ty       * safe(fx + 1, fy + 1);
  }

  decay() {
    for (let ch = 0; ch < this.grids.length; ch++) {
      const rate = ch < 2 ? CONFIG.PHERO_DECAY : CONFIG.ALARM_DECAY;
      const g = this.grids[ch];
      for (let i = 0; i < g.length; i++) {
        g[i] *= rate;
        if (g[i] < 0.5) g[i] = 0;
      }
    }
  }

  /**
   * Three-sensor steering: sample pheromone at left, forward, and right probes.
   * Returns a steer offset in radians, or null when no signal is detected.
   */
  steer(channel, x, y, dir) {
    const dist = CONFIG.PHERO_SENSE_DIST;
    const ang  = CONFIG.PHERO_SENSE_ANG;
    const L = this.sample(channel, x + dist * Math.cos(dir - ang), y + dist * Math.sin(dir - ang));
    const F = this.sample(channel, x + dist * Math.cos(dir),       y + dist * Math.sin(dir));
    const R = this.sample(channel, x + dist * Math.cos(dir + ang), y + dist * Math.sin(dir + ang));
    if (L === 0 && F === 0 && R === 0) return null;
    if (L > F && L > R) return -ang;
    if (R > F && R > L) return  ang;
    return 0;
  }

  // ---- Alarm pheromone helpers ----

  /** Deposit alarm pheromone at (x,y) for the given colony. */
  depositAlarm(colony, x, y, amount) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || xi >= this.cols || yi < 0 || yi >= this.rows) return;
    const i = yi * this.cols + xi;
    this.grids[colony + 2][i] = Math.min(CONFIG.ALARM_MAX, this.grids[colony + 2][i] + amount);
  }

  /** Returns the bilinear-sampled alarm strength at (x,y) for given colony. */
  senseAlarm(colony, x, y) {
    return this.sample(colony + 2, x, y);
  }

  /**
   * Three-sensor steer toward the alarm pheromone source.
   * Uses a longer sense distance than the food trail steer.
   */
  steerAlarm(colony, x, y, dir) {
    const dist = CONFIG.ALARM_SENSE_DIST;
    const ang  = CONFIG.PHERO_SENSE_ANG;
    const ch   = colony + 2;
    const L = this.sample(ch, x + dist * Math.cos(dir - ang), y + dist * Math.sin(dir - ang));
    const F = this.sample(ch, x + dist * Math.cos(dir),       y + dist * Math.sin(dir));
    const R = this.sample(ch, x + dist * Math.cos(dir + ang), y + dist * Math.sin(dir + ang));
    if (L === 0 && F === 0 && R === 0) return null;
    if (L > F && L > R) return -ang;
    if (R > F && R > L) return  ang;
    return 0;
  }
}
