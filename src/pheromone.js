'use strict';

// Two trail channels — one per colony (index matches colony index 0/1)
const PHERO = Object.freeze({ BLACK: 0, RED: 1 });

class PheromoneGrid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    // grids[0] = black colony food trail, grids[1] = red colony food trail
    this.grids = [new Float32Array(n), new Float32Array(n)];
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
    const rate = CONFIG.PHERO_DECAY;
    for (let ch = 0; ch < 2; ch++) {
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
}
