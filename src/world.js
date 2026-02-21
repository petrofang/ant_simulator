'use strict';

const Tile = Object.freeze({
  GRASS:    0,
  FOOD:     1,
  NEST:     2,
  OBSTACLE: 3,
});

class World {
  constructor() {
    this.cols = CONFIG.COLS;
    this.rows = CONFIG.ROWS;
    const n = this.cols * this.rows;
    this.tiles    = new Uint8Array(n);
    this.food     = new Float32Array(n);
    // Per-cell shade for subtle grass variation
    this.shade    = new Uint8Array(n);
  }

  idx(x, y) { return y * this.cols + x; }

  getTile(x, y)  { return this.tiles[this.idx(x, y)]; }
  getFoodAt(x, y) { return this.food[this.idx(x, y)]; }

  inBounds(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  passable(x, y) {
    return this.inBounds(x, y) && this.getTile(x, y) !== Tile.OBSTACLE;
  }

  generate(blackNest, redNest) {
    this.tiles.fill(Tile.GRASS);
    this.food.fill(0);

    // Subtle grass variation
    for (let i = 0; i < this.shade.length; i++) {
      this.shade[i] = Math.floor(Math.random() * 20);
    }

    // Scatter obstacles (rocks / pebbles) — ~4% of cells
    for (let i = 0; i < this.cols * this.rows * 0.04; i++) {
      const x = Math.floor(Math.random() * this.cols);
      const y = Math.floor(Math.random() * this.rows);
      this.tiles[this.idx(x, y)] = Tile.OBSTACLE;
    }

    // Food clusters
    for (let c = 0; c < CONFIG.FOOD_CLUSTERS; c++) {
      const cx = 5 + Math.floor(Math.random() * (this.cols - 10));
      const cy = 5 + Math.floor(Math.random() * (this.rows - 10));
      const r  = CONFIG.FOOD_RADIUS;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const gx = cx + dx, gy = cy + dy;
          if (!this.inBounds(gx, gy)) continue;
          if (Math.sqrt(dx * dx + dy * dy) > r) continue;
          const i = this.idx(gx, gy);
          this.food[i] += CONFIG.FOOD_PER_CELL * (0.6 + Math.random() * 0.8);
          this.tiles[i] = Tile.FOOD;
        }
      }
    }

    // Mark nest areas for both colonies
    this._markNest(blackNest.x, blackNest.y);
    this._markNest(redNest.x,   redNest.y);
  }

  _markNest(cx, cy) {
    const r = CONFIG.NEST_R;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx, gy = cy + dy;
        if (!this.inBounds(gx, gy)) continue;
        if (Math.sqrt(dx * dx + dy * dy) > r) continue;
        const i = this.idx(gx, gy);
        this.tiles[i] = Tile.NEST;
        this.food[i]  = 0;
      }
    }
  }

  takeFood(x, y, amount) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (!this.inBounds(xi, yi)) return 0;
    const i = this.idx(xi, yi);
    const taken = Math.min(amount, this.food[i]);
    this.food[i] -= taken;
    if (this.food[i] <= 0) {
      this.food[i] = 0;
      if (this.tiles[i] === Tile.FOOD) this.tiles[i] = Tile.GRASS;
    }
    return taken;
  }

  hasFood(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    return this.inBounds(xi, yi) && this.food[this.idx(xi, yi)] > 0;
  }

  isNest(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    return this.inBounds(xi, yi) && this.tiles[this.idx(xi, yi)] === Tile.NEST;
  }
}
