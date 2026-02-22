'use strict';

class Renderer {
  constructor(canvas, world, pheromones) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.world      = world;
    this.pheromones = pheromones;
    this.showPheromones = true;
    this._frame     = 0;

    // Offscreen buffer for world tiles
    this._worldBuf  = document.createElement('canvas');
    this._worldBuf.width  = CONFIG.CANVAS_W;
    this._worldBuf.height = CONFIG.CANVAS_H;
    this._worldCtx  = this._worldBuf.getContext('2d');
    this._worldImg  = this._worldCtx.createImageData(CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    // Pheromone overlay buffer
    this._pheroBuf  = document.createElement('canvas');
    this._pheroBuf.width  = CONFIG.CANVAS_W;
    this._pheroBuf.height = CONFIG.CANVAS_H;
    this._pheroCtx  = this._pheroBuf.getContext('2d');
    this._pheroImg  = this._pheroCtx.createImageData(CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    // Minimap canvas (exposed via id)
    this._minimap   = document.getElementById('minimap-canvas');
    this._minimapCtx = this._minimap ? this._minimap.getContext('2d') : null;
  }

  render(colonies, playerAnt) {
    this._frame++;
    this._buildWorldImage();
    this.ctx.drawImage(this._worldBuf, 0, 0);

    if (this.showPheromones) {
      this._buildPheroImage();
      // Draw with a soft gaussian blur for a glowing trail effect
      this.ctx.save();
      this.ctx.filter = 'blur(5px)';
      this.ctx.drawImage(this._pheroBuf, 0, 0);
      this.ctx.filter = 'none';
      this.ctx.restore();
    }

    this._drawAnts(colonies, playerAnt);

    if (this._minimapCtx) this._renderMinimap(colonies, playerAnt);
  }

  // ---- World tile image ----
  _buildWorldImage() {
    const { tiles, food, shade, pixelNoise, cols, rows, explored } = this.world;
    const C    = CONFIG.CELL;
    const W    = CONFIG.CANVAS_W;
    const data = this._worldImg.data;

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const i    = ty * cols + tx;
        const tile = tiles[i];
        const fd   = food[i];
        const sh   = shade[i]; // 0-19

        let r, g, b;
        switch (tile) {
          case Tile.GRASS: {
            // Base rich green — darker clumps when sh < 6
            const dark = sh < 6 ? 8 : 0;
            r = 34 + sh - dark;
            g = 80 + sh - dark * 2;
            b = 28;
            break;
          }
          case Tile.FOOD: {
            // Bright lime green, more saturated when well-stocked
            const t = Math.min(1, fd / (CONFIG.FOOD_PER_CELL * 1.2));
            r = Math.floor(20 + 55 * (1 - t));
            g = Math.floor(125 + 90 * t);
            b = Math.floor(8  + 35 * t);
            break;
          }
          case Tile.NEST: {
            r = 125 + sh;
            g = 92  + sh;
            b = 48;
            break;
          }
          case Tile.OBSTACLE: {
            const rock = Math.floor(sh * 1.4);
            r = 72 + rock;
            g = 68 + rock;
            b = 62 + rock;
            break;
          }
          default: {
            r = 34; g = 80; b = 28;
          }
        }

        // Fog of war — near-black for unexplored cells
        if (!explored[i]) {
          r = 3; g = 4; b = 6;
        }

        // Fill CELL×CELL pixel block with per-pixel sub-noise for organic texture
        for (let py = ty * C; py < (ty + 1) * C; py++) {
          for (let px = tx * C; px < (tx + 1) * C; px++) {
            const pi = (py * W + px) * 4;
            const n  = pixelNoise[py * W + px]; // 0-19 variation
            const nr = Math.max(0, Math.min(255, r + n - 10));
            const ng = Math.max(0, Math.min(255, g + n - 10));
            const nb = Math.max(0, Math.min(255, b + (n >> 1) - 5));
            data[pi]     = nr;
            data[pi + 1] = ng;
            data[pi + 2] = nb;
            data[pi + 3] = 255;
          }
        }
      }
    }
    this._worldCtx.putImageData(this._worldImg, 0, 0);
  }

  // ---- Pheromone overlay (blurred in render()) ----
  _buildPheroImage() {
    const cols  = CONFIG.COLS, rows = CONFIG.ROWS;
    const C     = CONFIG.CELL;
    const W     = CONFIG.CANVAS_W;
    const bGrid  = this.pheromones.grids[PHERO.BLACK];
    const rGrid  = this.pheromones.grids[PHERO.RED];
    const abGrid = this.pheromones.grids[PHERO.ALARM_BLACK];
    const arGrid = this.pheromones.grids[PHERO.ALARM_RED];
    const expl   = this.world.explored;
    const data   = this._pheroImg.data;

    data.fill(0);

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const i = ty * cols + tx;
        if (!expl[i]) continue;  // don't reveal pheromones through fog

        const bv  = bGrid[i];
        const rv  = rGrid[i];
        const abv = abGrid[i];
        const arv = arGrid[i];
        if (bv < 1 && rv < 1 && abv < 1 && arv < 1) continue;

        // Alarm takes priority if stronger than half the food signal
        const maxAlarm = Math.max(abv, arv);
        const maxFood  = Math.max(bv, rv);
        let pr, pg, pb, pa;
        if (maxAlarm > 0 && maxAlarm >= maxFood * 0.3) {
          if (abv >= arv) {
            pa = Math.floor(Math.min(220, abv / CONFIG.ALARM_MAX * 230));
            pr = 255; pg = 140; pb = 0;   // black-colony alarm — orange
          } else {
            pa = Math.floor(Math.min(220, arv / CONFIG.ALARM_MAX * 230));
            pr = 255; pg = 220; pb = 0;   // red-colony alarm — yellow
          }
        } else {
          if (bv >= rv) {
            pa = Math.floor(Math.min(220, bv / CONFIG.PHERO_MAX * 230));
            pr = 60; pg = 140; pb = 255;
          } else {
            pa = Math.floor(Math.min(220, rv / CONFIG.PHERO_MAX * 230));
            pr = 255; pg = 60; pb = 60;
          }
        }

        for (let py = ty * C; py < (ty + 1) * C; py++) {
          for (let px = tx * C; px < (tx + 1) * C; px++) {
            const pi = (py * W + px) * 4;
            data[pi]     = pr;
            data[pi + 1] = pg;
            data[pi + 2] = pb;
            data[pi + 3] = pa;
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

        // Hide enemy ants that are in unexplored (fog-covered) territory
        if (ant.colony !== 0) {
          const xi = Math.floor(ant.x), yi = Math.floor(ant.y);
          if (!this.world.explored[yi * CONFIG.COLS + xi]) continue;
        }

        const sx = ant.x * C;
        const sy = ant.y * C;

        // Developmental stages — small dots with subtle pulse
        if (!ant.isMature) {
          const DEV_PULSE_BASE  = 0.8;
          const DEV_PULSE_AMP   = 0.2;
          const DEV_FRAME_SPEED = 0.08;
          const DEV_TICK_SPEED  = 0.05;
          const pulse = DEV_PULSE_BASE + DEV_PULSE_AMP * Math.sin(this._frame * DEV_FRAME_SPEED + ant.devTicks * DEV_TICK_SPEED);
          ctx.beginPath();
          ctx.arc(sx, sy, C * 0.3 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = ant.state === AntState.EGG   ? '#f0f0c8'
                        : ant.state === AntState.LARVA  ? '#d8c470'
                        : '#b89848';   // pupa
          ctx.fill();
          continue;
        }

        // Player ant: glowing animated pulse ring (drawn in screen space, before transform)
        if (ant === playerAnt) {
          const PLAYER_PULSE_SPEED       = 0.14;
          const PLAYER_RING_BASE_RADIUS  = 0.9;
          const PLAYER_RING_PULSE_RADIUS = 0.25;
          const PLAYER_ALPHA_BASE        = 0.55;
          const PLAYER_ALPHA_PULSE       = 0.45;
          const pulse   = 0.5 + 0.5 * Math.sin(this._frame * PLAYER_PULSE_SPEED);
          const radius  = C * (PLAYER_RING_BASE_RADIUS + pulse * PLAYER_RING_PULSE_RADIUS);
          const alpha   = PLAYER_ALPHA_BASE + pulse * PLAYER_ALPHA_PULSE;
          ctx.save();
          ctx.shadowColor = '#ffee00';
          ctx.shadowBlur  = 10 + pulse * 6;
          ctx.strokeStyle = `rgba(255, 238, 0, ${alpha})`;
          ctx.lineWidth   = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ant.dir);

        if (ant.type === AntType.QUEEN) {
          this._drawQueen(ctx, ant, C);
        } else {
          this._drawWorkerOrSoldier(ctx, ant, C);
        }

        // Hit flash — bright white overlay
        if (ant.hitFlash > 0) {
          ctx.globalAlpha = ant.hitFlash / 10 * 0.75;
          ctx.fillStyle   = ant.colony === 0 ? '#88ccff' : '#ff8888';
          ctx.beginPath();
          // Cover the whole ant with a circle
          ctx.arc(0, 0, C * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();

        // HP bar drawn in world space (not rotated) when ant is hurt
        if (ant.hp < ant.maxHp && ant.isMature && ant.type !== AntType.QUEEN) {
          const barW = C * 1.6;
          const barH = 2.5;
          const bx   = sx - barW / 2;
          const by   = sy - C * 1.0;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
          ctx.fillStyle = '#222';
          ctx.fillRect(bx, by, barW, barH);
          ctx.fillStyle = ant.colony === 0 ? '#44aaff' : '#ff5544';
          ctx.fillRect(bx, by, barW * (ant.hp / ant.maxHp), barH);
        }
      }
    }
  }

  _drawQueen(ctx, ant, C) {
    const isBlack = ant.colony === 0;
    const abdColor = isBlack ? '#1a1a1a' : '#8b0000';
    const thorColor = isBlack ? '#383838' : '#cc2200';

    // Gradient abdomen for 3D look
    const abdGrad = ctx.createRadialGradient(-C*0.15, -C*0.1, 0, -C*0.3, 0, C*0.55);
    abdGrad.addColorStop(0, isBlack ? '#505050' : '#cc3333');
    abdGrad.addColorStop(1, abdColor);
    ctx.fillStyle = abdGrad;
    ctx.beginPath();
    ctx.ellipse(-C * 0.3, 0, C * 0.54, C * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thorax
    ctx.fillStyle = thorColor;
    ctx.beginPath();
    ctx.ellipse(C * 0.1, 0, C * 0.22, C * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = abdColor;
    ctx.beginPath();
    ctx.ellipse(C * 0.4, 0, C * 0.19, C * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crown highlight
    ctx.fillStyle = isBlack ? 'rgba(200,200,200,0.25)' : 'rgba(255,180,180,0.35)';
    ctx.beginPath();
    ctx.ellipse(-C * 0.2, -C * 0.12, C * 0.28, C * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawWorkerOrSoldier(ctx, ant, C) {
    const isSoldier = ant.type === AntType.SOLDIER;
    const sc        = isSoldier ? 1.3 : 1.0;
    const isBlack   = ant.colony === 0;

    // Gradient colors
    const darkBody  = isBlack ? (isSoldier ? '#0e0e0e' : '#1c1c1c') : (isSoldier ? '#8b0000' : '#aa1111');
    const lightBody = isBlack ? (isSoldier ? '#404040' : '#383838') : (isSoldier ? '#cc3333' : '#dd4444');
    const legColor  = isBlack ? 'rgba(80,80,80,0.9)' : 'rgba(180,60,60,0.9)';

    // Animated leg swing
    const REAR_LEG_PHASE_OFFSET = 1.0; // stagger rear pair for natural gait
    const swing  = Math.sin(ant.legPhase);
    const swingS = Math.cos(ant.legPhase + REAR_LEG_PHASE_OFFSET); // staggered rear pair

    // ── Legs (drawn behind body) ──
    ctx.strokeStyle = legColor;
    ctx.lineWidth   = 0.8;
    const legXs = [-C * 0.2 * sc, 0, C * 0.18 * sc];
    for (let li = 0; li < 3; li++) {
      const lx   = legXs[li];
      const sway = (li === 1) ? swingS : swing;
      const tip  = C * 0.3 * sc;
      // Left leg
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx - C * 0.08 * sc, -(tip + sway * C * 0.12));
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx - C * 0.08 * sc,  (tip - sway * C * 0.12));
      ctx.stroke();
    }

    // ── Abdomen ──
    const abdGrad = ctx.createRadialGradient(-C*0.1*sc, -C*0.08*sc, 0, -C*0.28*sc, 0, C*0.26*sc);
    abdGrad.addColorStop(0, lightBody);
    abdGrad.addColorStop(1, darkBody);
    ctx.fillStyle = abdGrad;
    ctx.beginPath();
    ctx.ellipse(-C * 0.28 * sc, 0, C * 0.25 * sc, C * 0.17 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Thorax ──
    ctx.fillStyle = darkBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, C * 0.17 * sc, C * 0.14 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Head ──
    const headGrad = ctx.createRadialGradient(C*0.22*sc, -C*0.06*sc, 0, C*0.3*sc, 0, C*0.22*sc);
    headGrad.addColorStop(0, lightBody);
    headGrad.addColorStop(1, darkBody);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(C * 0.3 * sc, 0, C * 0.21 * sc, C * 0.15 * sc, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Mandibles (soldiers get bigger ones) ──
    if (isSoldier) {
      ctx.strokeStyle = isBlack ? '#555' : '#cc4444';
      ctx.lineWidth   = 1.1;
      ctx.beginPath();
      ctx.moveTo(C * 0.5, -C * 0.06);
      ctx.lineTo(C * 0.7, -C * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(C * 0.5,  C * 0.06);
      ctx.lineTo(C * 0.7,  C * 0.22);
      ctx.stroke();
    }

    // ── Antennae ──
    ctx.strokeStyle = isBlack ? 'rgba(120,120,120,0.8)' : 'rgba(200,80,80,0.8)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(C * 0.5 * sc, -C * 0.03);
    ctx.quadraticCurveTo(C * 0.7 * sc, -C * 0.15, C * 0.88 * sc, -C * 0.34 * sc);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(C * 0.5 * sc,  C * 0.03);
    ctx.quadraticCurveTo(C * 0.7 * sc,  C * 0.15, C * 0.88 * sc,  C * 0.34 * sc);
    ctx.stroke();

    // ── Food dot ──
    if (ant.carrying > 0) {
      const FOOD_GLOW_BLUR = 4;
      ctx.fillStyle = '#55ff55';
      ctx.shadowColor = '#44ff44';
      ctx.shadowBlur  = FOOD_GLOW_BLUR;
      ctx.beginPath();
      ctx.arc(-C * 0.28 * sc, 0, C * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // ---- Minimap ----
  _renderMinimap(colonies, playerAnt) {
    const mc  = this._minimapCtx;
    const mw  = this._minimap.width;
    const mh  = this._minimap.height;
    const scX = mw / CONFIG.COLS;
    const scY = mh / CONFIG.ROWS;

    mc.clearRect(0, 0, mw, mh);

    // Background (dark green)
    mc.fillStyle = '#1a3a1a';
    mc.fillRect(0, 0, mw, mh);

    // Food sources
    const { tiles, food, cols, rows } = this.world;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const i = ty * cols + tx;
        if (tiles[i] === Tile.FOOD) {
          const t = Math.min(1, food[i] / (CONFIG.FOOD_PER_CELL * 2));
          mc.fillStyle = `rgba(50, ${Math.floor(140 + 100 * t)}, 30, 0.9)`;
          mc.fillRect(tx * scX, ty * scY, scX + 0.5, scY + 0.5);
        }
        if (tiles[i] === Tile.NEST) {
          // Nest areas drawn separately below
        }
      }
    }

    // Colony nests
    for (const colony of colonies) {
      mc.fillStyle = colony.idx === 0 ? 'rgba(150,200,255,0.6)' : 'rgba(255,100,100,0.6)';
      const nx = colony.nestX * scX, ny = colony.nestY * scY;
      mc.beginPath();
      mc.arc(nx, ny, CONFIG.NEST_R * scX * 1.5, 0, Math.PI * 2);
      mc.fill();
    }

    // Ant dots
    for (const colony of colonies) {
      mc.fillStyle = colony.idx === 0 ? 'rgba(160,210,255,0.7)' : 'rgba(255,130,130,0.7)';
      for (const ant of colony.ants) {
        if (!ant.isMature || ant.isDead) continue;
        mc.fillRect(ant.x * scX - 0.5, ant.y * scY - 0.5, 1.5, 1.5);
      }
    }

    // Player ant — bright yellow dot
    if (playerAnt && !playerAnt.isDead) {
      const px = playerAnt.x * scX;
      const py = playerAnt.y * scY;
      mc.fillStyle = '#ffee00';
      mc.beginPath();
      mc.arc(px, py, 2.5, 0, Math.PI * 2);
      mc.fill();
    }

    // Fog of war overlay on minimap
    const { explored, cols: wcols, rows: wrows } = this.world;
    mc.fillStyle = 'rgba(0,0,0,0.82)';
    for (let ty = 0; ty < wrows; ty++) {
      for (let tx = 0; tx < wcols; tx++) {
        if (!explored[ty * wcols + tx]) {
          mc.fillRect(tx * scX, ty * scY, scX + 0.5, scY + 0.5);
        }
      }
    }

    // Border
    mc.strokeStyle = 'rgba(255,255,255,0.15)';
    mc.lineWidth   = 1;
    mc.strokeRect(0, 0, mw, mh);
  }
}
