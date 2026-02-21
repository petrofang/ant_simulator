'use strict';

class Game {
  constructor() {
    this.canvas        = document.getElementById('game-canvas');
    this.canvas.width  = CONFIG.CANVAS_W;
    this.canvas.height = CONFIG.CANVAS_H;

    this.tick        = 0;
    this.paused      = false;
    this.gameOver    = false;
    this.speedLevel  = 0; // index into CONFIG.SPEED_LEVELS

    this.ui = new UI();

    this._init();
    this._bindEvents();
    this._fitCanvas();
    window.addEventListener('resize', () => this._fitCanvas());

    this.ui.setStatus('Lead your colony! Collect food and defeat the red ants. WASD / arrows to move your ant.');
    requestAnimationFrame(this._loop.bind(this));
  }

  // ---- Canvas CSS scaling to fill the wrapper ----
  _fitCanvas() {
    const wrapper = this.canvas.parentElement;
    const { width: ww, height: wh } = wrapper.getBoundingClientRect();
    const scaleX = ww / CONFIG.CANVAS_W;
    const scaleY = wh / CONFIG.CANVAS_H;
    this._cssScale = Math.min(scaleX, scaleY);
    this.canvas.style.transform = `scale(${this._cssScale})`;
    this.canvas.style.transformOrigin = 'center center';
    // Use crisp-edges only when zoomed-in (scale > 1)
    this.canvas.style.imageRendering = this._cssScale > 1 ? 'pixelated' : 'auto';
  }

  // ---- Initialise / restart ----
  _init() {
    this.world      = new World();
    this.pheromones = new PheromoneGrid(CONFIG.COLS, CONFIG.ROWS);

    // Colonies on opposite sides, vertically centred
    const blackNest = { x: 18, y: Math.floor(CONFIG.ROWS / 2) };
    const redNest   = { x: CONFIG.COLS - 18, y: Math.floor(CONFIG.ROWS / 2) };

    this.world.generate(blackNest, redNest);

    this.blackColony = new Colony(blackNest.x, blackNest.y, 0, this.world, this.pheromones);
    this.redColony   = new Colony(redNest.x,   redNest.y,   1, this.world, this.pheromones);

    this.blackColony.init();
    this.redColony.init();

    // Player controls one specific black worker ant
    this.playerAnt = this.blackColony.ants.find(
      a => a.type === AntType.WORKER && a.isMature,
    );
    if (this.playerAnt) this.playerAnt.isPlayer = true;

    this.renderer = new Renderer(this.canvas, this.world, this.pheromones);

    this.keys = {};
  }

  // ---- Input ----
  _bindEvents() {
    document.addEventListener('keydown', e => {
      this.keys[e.code] = true;

      if (e.code === 'Space') {
        this.renderer.showPheromones = !this.renderer.showPheromones;
        e.preventDefault();
      }
      if (e.code === 'KeyP') {
        this.paused = !this.paused;
        this.ui.setStatus(this.paused ? 'Paused — press P to resume.' : 'Resumed.');
      }
      if (e.code === 'KeyR') {
        this._restart();
      }
      // Speed control — number keys 1-4
      if (e.code === 'Digit1') this._setSpeed(0);
      if (e.code === 'Digit2') this._setSpeed(1);
      if (e.code === 'Digit3') this._setSpeed(2);
      if (e.code === 'Digit4') this._setSpeed(3);
      // Speed up/down with + / -
      if (e.code === 'Equal' || e.code === 'NumpadAdd')      this._setSpeed(Math.min(3, this.speedLevel + 1));
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') this._setSpeed(Math.max(0, this.speedLevel - 1));
    });

    document.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // Click: aim player ant OR select a friendly worker to control
    this.canvas.addEventListener('click', e => {
      if (this.gameOver) return;
      const rect  = this.canvas.getBoundingClientRect();
      const scale = this._cssScale || 1;
      // Account for CSS scaling: the rendered canvas may be displayed larger/smaller
      const wx = (e.clientX - rect.left) * (CONFIG.CANVAS_W / rect.width)  / CONFIG.CELL;
      const wy = (e.clientY - rect.top)  * (CONFIG.CANVAS_H / rect.height) / CONFIG.CELL;

      // Check if clicked near a friendly ant — if so, take control of it
      const picked = this._pickFriendlyAnt(wx, wy);
      if (picked && picked !== this.playerAnt) {
        if (this.playerAnt) this.playerAnt.isPlayer = false;
        this.playerAnt          = picked;
        picked.isPlayer         = true;
        this.ui.setStatus('Switched to a new ant!');
        return;
      }

      // Otherwise just aim the current player ant
      if (this.playerAnt && !this.playerAnt.isDead) {
        this.playerAnt.dir = Math.atan2(wy - this.playerAnt.y, wx - this.playerAnt.x);
      }
    });
  }

  _pickFriendlyAnt(wx, wy) {
    const pickR2 = CONFIG.ANT_PICK_RADIUS * CONFIG.ANT_PICK_RADIUS;
    let best = null, bestD = Infinity;
    for (const ant of this.blackColony.ants) {
      if (!ant.isMature || ant.isDead || ant.type === AntType.QUEEN) continue;
      const dx = ant.x - wx, dy = ant.y - wy;
      const d  = dx * dx + dy * dy;
      if (d < pickR2 && d < bestD) { bestD = d; best = ant; }
    }
    return best;
  }

  _setSpeed(level) {
    this.speedLevel = level;
    const mult = CONFIG.SPEED_LEVELS[level];
    this.ui.setSpeed(mult);
  }

  _handlePlayerInput() {
    if (!this.playerAnt || this.playerAnt.isDead) {
      // Auto-respawn: pick a new worker to control
      const next = this.blackColony.ants.find(
        a => a.type === AntType.WORKER && a.isMature && !a.isDead && !a.isPlayer,
      );
      if (next) {
        next.isPlayer  = true;
        this.playerAnt = next;
        this.ui.setStatus('Your ant died — you are now controlling a new worker.');
      }
      return;
    }
    const p = this.playerAnt;

    const up    = this.keys['ArrowUp']    || this.keys['KeyW'];
    const down  = this.keys['ArrowDown']  || this.keys['KeyS'];
    const left  = this.keys['ArrowLeft']  || this.keys['KeyA'];
    const right = this.keys['ArrowRight'] || this.keys['KeyD'];

    let targetDir = null;
    if      (up    && right) targetDir = -Math.PI / 4;
    else if (up    && left)  targetDir = -Math.PI * 3 / 4;
    else if (down  && right) targetDir =  Math.PI / 4;
    else if (down  && left)  targetDir =  Math.PI * 3 / 4;
    else if (up)             targetDir = -Math.PI / 2;
    else if (down)           targetDir =  Math.PI / 2;
    else if (left)           targetDir =  Math.PI;
    else if (right)          targetDir =  0;

    if (targetDir !== null) {
      // Smooth turning — gradually approach target direction
      let diff = targetDir - p.dir;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.dir += diff * CONFIG.SMOOTH_TURN_RATE;
    }
  }

  // ---- Restart ----
  _restart() {
    this.gameOver   = false;
    this.paused     = false;
    this.tick       = 0;
    this.speedLevel = 0;
    this.ui.hideMessage();
    this._init();
    this.ui.setSpeed(1);
    this.ui.setStatus('New game started. Lead your colony!');
  }

  // ---- Win / lose ----
  _checkEndConditions() {
    if (!this.blackColony.alive) {
      this.gameOver = true;
      this.ui.showMessage('☠  Your colony was destroyed!\nPress R to restart.', '#ff4444');
    } else if (!this.redColony.alive) {
      this.gameOver = true;
      this.ui.showMessage('🏆  Victory! Red colony destroyed!\nPress R to restart.', '#44ff88');
    }
  }

  // ---- Kill tally ----
  _totalKills() {
    return this.blackColony.ants.reduce((sum, a) => sum + (a.kills || 0), 0);
  }

  // ---- Main simulation step ----
  _update() {
    if (this.paused || this.gameOver) return;

    const ticks = CONFIG.TICKS_PER_FRAME * CONFIG.SPEED_LEVELS[this.speedLevel];
    for (let t = 0; t < ticks; t++) {
      this.tick++;

      this._handlePlayerInput();
      this.pheromones.decay();

      const allAnts = [...this.blackColony.ants, ...this.redColony.ants];
      this.blackColony.update(allAnts);
      this.redColony.update(allAnts);

      this._checkEndConditions();
    }
  }

  // ---- Game loop ----
  _loop() {
    this._update();
    this.renderer.render([this.blackColony, this.redColony], this.playerAnt);
    this.ui.update(this.blackColony, this.redColony, this.tick, this.playerAnt, this._totalKills());
    requestAnimationFrame(this._loop.bind(this));
  }
}

window.addEventListener('load', () => { new Game(); });
