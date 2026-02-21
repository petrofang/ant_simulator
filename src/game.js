'use strict';

class Game {
  constructor() {
    this.canvas        = document.getElementById('game-canvas');
    this.canvas.width  = CONFIG.CANVAS_W;
    this.canvas.height = CONFIG.CANVAS_H;

    this.tick     = 0;
    this.paused   = false;
    this.gameOver = false;

    this.ui = new UI();

    this._init();
    this._bindEvents();

    this.ui.setStatus('Lead your colony! Collect food and defeat the red ants. A worker will mature shortly – use WASD/arrow keys once it appears.');
    requestAnimationFrame(this._loop.bind(this));
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
      // movement keys should not trigger page scrolling/etc
      const movementKeys = [
        'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
        'KeyW','KeyA','KeyS','KeyD'
      ];
      if (movementKeys.includes(e.code)) {
        e.preventDefault();
      }

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
    });

    document.addEventListener('keyup', e => {
      const movementKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'];
      if (movementKeys.includes(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = false;
    });

    // Click to aim player ant
    this.canvas.addEventListener('click', e => {
      if (!this.playerAnt || this.playerAnt.isDead) return;
      const rect = this.canvas.getBoundingClientRect();
      const wx   = (e.clientX - rect.left)  / CONFIG.CELL;
      const wy   = (e.clientY - rect.top)   / CONFIG.CELL;
      this.playerAnt.dir = Math.atan2(wy - this.playerAnt.y, wx - this.playerAnt.x);
    });
  }

  _handlePlayerInput() {
    if (!this.playerAnt || this.playerAnt.isDead) return;
    const p = this.playerAnt;

    const up    = this.keys['ArrowUp']    || this.keys['KeyW'];
    const down  = this.keys['ArrowDown']  || this.keys['KeyS'];
    const left  = this.keys['ArrowLeft']  || this.keys['KeyA'];
    const right = this.keys['ArrowRight'] || this.keys['KeyD'];

    // debug: uncomment to log keys each frame
    // console.log('input', {up,down,left,right,dir: p.dir});

    if      (up    && right) p.dir = -Math.PI / 4;
    else if (up    && left)  p.dir = -Math.PI * 3 / 4;
    else if (down  && right) p.dir =  Math.PI / 4;
    else if (down  && left)  p.dir =  Math.PI * 3 / 4;
    else if (up)             p.dir = -Math.PI / 2;
    else if (down)           p.dir =  Math.PI / 2;
    else if (left)           p.dir = Math.PI;
    else if (right)          p.dir = 0;
  }

  // ---- Restart ----
  _restart() {
    this.gameOver = false;
    this.paused   = false;
    this.tick     = 0;
    this.ui.hideMessage();
    this._init();
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

  // ---- Main simulation step ----
  _update() {
    if (this.paused || this.gameOver) return;

    for (let t = 0; t < CONFIG.TICKS_PER_FRAME; t++) {
      this.tick++;

      // make sure we have a player ant; a mature worker may not exist at start
      if (!this.playerAnt || this.playerAnt.isDead) {
        const newPlayer = this.blackColony.ants.find(
          a => a.type === AntType.WORKER && a.isMature,
        );
        if (newPlayer) {
          this.playerAnt = newPlayer;
          this.playerAnt.isPlayer = true;
          this.ui.setStatus('A worker has matured – you can now control it.');
        }
      }

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
    this.ui.update(this.blackColony, this.redColony, this.tick);
    requestAnimationFrame(this._loop.bind(this));
  }
}

window.addEventListener('load', () => { new Game(); });
