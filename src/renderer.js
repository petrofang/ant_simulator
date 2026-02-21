'use strict';

class Renderer {
  constructor(canvas, world, pheromones) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.world      = world;
    this.pheromones = pheromones;
    this.showPheromones = true;

    // Offscreen buffer for world tiles (redrawn only when world changes)
    this._worldDirty = true;
    this._worldBuf   = document.createElement('canvas');
    this._worldBuf.width  = CONFIG.CANVAS_W;
    this._worldBuf.height = CONFIG.CANVAS_H;
    this._worldCtx = this._worldBuf.getContext('2d');
    this._worldImg = this._worldCtx.createImageData(CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    // Pheromone overlay buffer
    this._pheroBuf = document.createElement('canvas');
    this._pheroBuf.width  = CONFIG.CANVAS_W;
    this._pheroBuf.height = CONFIG.CANVAS_H;
    this._pheroCtx = this._pheroBuf.getContext('2d');
    this._pheroImg = this._pheroCtx.createImageData(CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  render(colonies, playerAnt) {
    this._buildWorldImage();
    this.ctx.drawImage(this._worldBuf, 0, 0);

    if (this.showPheromones) {
      this._buildPheroImage();
      this.ctx.drawImage(this._pheroBuf, 0, 0);
    }

    this._drawAnts(colonies, playerAnt);
  }

  // ---- World tile image (rebuilt every frame because food changes) ----
  _buildWorldImage() {
    const { tiles, food, shade, cols, rows } = this.world;
    const C    = CONFIG.CELL;
    const W    = CONFIG.CANVAS_W;
    const data = this._worldImg.data;

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const i    = ty * cols + tx;
        const tile = tiles[i];
        const fd   = food[i];
        const sh   = shade[i];  // 0-19 variation

        let r, g, b;
        switch (tile) {
          case Tile.GRASS: {
            r = 38  + sh;
            g = 88  + sh;
            b = 34;
            break;
          }
          case Tile.FOOD: {
            const t = Math.min(1, fd / (CONFIG.FOOD_PER_CELL * 1.2));
            r = Math.floor(30  + 20  * (1 - t));
            g = Math.floor(110 + 100 * t);
            b = 20;
            break;
          }
          case Tile.NEST: {
            r = 118 + sh;
            g = 85  + sh;
            b = 45;
            break;
          }
          case Tile.OBSTACLE: {
            r = 82  + sh;
            g = 72  + sh;
            b = 62  + sh;
            break;
          }
          default: {
            r = 38; g = 88; b = 34;
          }
        }

        // Fill CELL×CELL pixel block
        for (let py = ty * C; py < (ty + 1) * C; py++) {
          for (let px = tx * C; px < (tx + 1) * C; px++) {
            const pi = (py * W + px) * 4;
            data[pi]     = r;
            data[pi + 1] = g;
            data[pi + 2] = b;
            data[pi + 3] = 255;
          }
        }
      }
    }
    this._worldCtx.putImageData(this._worldImg, 0, 0);
  }

  // ---- Pheromone overlay ----
  _buildPheroImage() {
    const cols = CONFIG.COLS, rows = CONFIG.ROWS;
    const C    = CONFIG.CELL;
    const W    = CONFIG.CANVAS_W;
    const bGrid = this.pheromones.grids[PHERO.BLACK];
    const rGrid = this.pheromones.grids[PHERO.RED];
    const data  = this._pheroImg.data;

    // Clear
    data.fill(0);

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const i  = ty * cols + tx;
        const bv = bGrid[i];
        const rv = rGrid[i];
        if (bv < 1 && rv < 1) continue;

        const ba = Math.floor(Math.min(200, bv / CONFIG.PHERO_MAX * 210));
        const ra = Math.floor(Math.min(200, rv / CONFIG.PHERO_MAX * 210));

        for (let py = ty * C; py < (ty + 1) * C; py++) {
          for (let px = tx * C; px < (tx + 1) * C; px++) {
            const pi = (py * W + px) * 4;
            // Blue tint for black colony, red tint for red colony
            if (bv > rv) {
              data[pi]     = 80;
              data[pi + 1] = 160;
              data[pi + 2] = 255;
              data[pi + 3] = ba;
            } else {
              data[pi]     = 255;
              data[pi + 1] = 80;
              data[pi + 2] = 80;
              data[pi + 3] = ra;
            }
          }
        }
      }
    }
    this._pheroCtx.putImageData(this._pheroImg, 0, 0);
  }

  // ---- Ant drawing ----
  _drawAnts(colonies, playerAnt) {
    const ctx = this.ctx;
    const C   = CONFIG.CELL;

    for (const colony of colonies) {
      for (const ant of colony.ants) {
        if (ant.isDead) continue;
        const sx = ant.x * C;
        const sy = ant.y * C;

        // Developmental stages — small coloured dots
        if (!ant.isMature) {
          ctx.beginPath();
          ctx.arc(sx, sy, C * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = ant.state === AntState.EGG   ? '#f8f8d0'
                        : ant.state === AntState.LARVA  ? '#e0cc88'
                        : '#c8aa66';   // pupa
          ctx.fill();
          continue;
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ant.dir);

        // Player highlight ring
        if (ant === playerAnt) {
          ctx.strokeStyle = '#ffee00';
          ctx.lineWidth   = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, C * 0.75, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (ant.type === AntType.QUEEN) {
          this._drawQueen(ctx, ant, C);
        } else {
          this._drawWorkerOrSoldier(ctx, ant, C);
        }

        ctx.restore();
      }
    }
  }

  _drawQueen(ctx, ant, C) {
    const isBlackColony = ant.colony === 0;
    const body = isBlackColony ? '#111' : '#880000';
    const head = isBlackColony ? '#333' : '#cc2200';

    // Large abdomen
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-C * 0.3, 0, C * 0.52, C * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thorax
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.ellipse(C * 0.1, 0, C * 0.22, C * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(C * 0.38, 0, C * 0.18, C * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawWorkerOrSoldier(ctx, ant, C) {
    const isSoldier = ant.type === AntType.SOLDIER;
    const sc        = isSoldier ? 1.25 : 1.0;
    const isBlackColony = ant.colony === 0;
    const bodyColor = isBlackColony ? (isSoldier ? '#111' : '#222') : (isSoldier ? '#990000' : '#bb2222');
    const legColor  = isBlackColony ? '#1a1a1a' : '#991111';

    // Abdomen
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(-C * 0.28 * sc, 0, C * 0.24 * sc, C * 0.16 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thorax
    ctx.beginPath();
    ctx.ellipse(0, 0, C * 0.16 * sc, C * 0.13 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(C * 0.3 * sc, 0, C * 0.2 * sc, C * 0.14 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs — 3 pairs
    ctx.strokeStyle = legColor;
    ctx.lineWidth   = 0.6;
    const legOffsets = [-C * 0.18 * sc, 0, C * 0.18 * sc];
    for (const lx of legOffsets) {
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx - C * 0.1, -C * 0.28 * sc); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx - C * 0.1,  C * 0.28 * sc); ctx.stroke();
    }

    // Antennae
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.moveTo(C * 0.48 * sc, 0);
    ctx.lineTo(C * 0.82 * sc, -C * 0.32 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(C * 0.48 * sc, 0);
    ctx.lineTo(C * 0.82 * sc,  C * 0.32 * sc);
    ctx.stroke();

    // Food dot
    if (ant.carrying > 0) {
      ctx.fillStyle = '#44ff44';
      ctx.beginPath();
      ctx.arc(C * 0.0, 0, C * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
