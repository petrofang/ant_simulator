'use strict';

class Colony {
  constructor(nestX, nestY, colonyIdx, world, pheromones) {
    this.nestX      = nestX;
    this.nestY      = nestY;
    this.idx        = colonyIdx;  // 0 = black, 1 = red
    this.world      = world;
    this.pheromones = pheromones;
    this.ants       = [];
    this.food       = CONFIG.START_FOOD;
    this.layTimer   = 0;
    this.alive      = true;
    this.queen      = null;
  }

  init() {
    // Create queen (stays at nest)
    this.queen        = new Ant(this.nestX, this.nestY, AntType.QUEEN, this.idx);
    this.queen.nestX  = this.nestX;
    this.queen.nestY  = this.nestY;
    this.ants.push(this.queen);

    for (let i = 0; i < CONFIG.START_WORKERS; i++)  this.spawnAnt(AntType.WORKER);
    for (let i = 0; i < CONFIG.START_SOLDIERS; i++) this.spawnAnt(AntType.SOLDIER);
  }

  spawnAnt(type) {
    const angle = Math.random() * Math.PI * 2;
    const r     = Math.random() * CONFIG.NEST_R;
    const ant   = new Ant(
      this.nestX + r * Math.cos(angle),
      this.nestY + r * Math.sin(angle),
      type,
      this.idx,
    );
    ant.nestX  = this.nestX;
    ant.nestY  = this.nestY;
    this.ants.push(ant);
    return ant;
  }

  // Convenience counts
  get workers()    { return this.ants.filter(a => a.type === AntType.WORKER  && a.isMature && !a.isDead).length; }
  get soldiers()   { return this.ants.filter(a => a.type === AntType.SOLDIER && a.isMature && !a.isDead).length; }
  get developing() { return this.ants.filter(a => !a.isMature && !a.isDead).length; }
  get totalPop()   { return this.ants.filter(a => !a.isDead).length; }

  update(allAnts) {
    if (!this.alive) return;

    // Cull dead ants from list
    this.ants = this.ants.filter(a => !a.isDead);

    // Check queen is still alive
    if (!this.ants.includes(this.queen)) {
      this.alive = false;
      return;
    }

    // Collect food carried by ants arriving at the nest
    for (const ant of this.ants) {
      if (ant.carrying > 0 && this.world.isNest(ant.x, ant.y)) {
        this.food   += ant.carrying;
        ant.carrying = 0;
      }
    }

    // Queen lays eggs if resources allow
    this.layTimer++;
    if (
      this.layTimer >= CONFIG.LAY_INTERVAL &&
      this.food     >= CONFIG.LAY_COST     &&
      this.totalPop <  CONFIG.MAX_POP
    ) {
      const egg    = Ant.createEgg(this.nestX, this.nestY, this.idx);
      egg.nestX    = this.nestX;
      egg.nestY    = this.nestY;
      this.ants.push(egg);
      this.food   -= CONFIG.LAY_COST;
      this.layTimer = 0;
    }

    // Update individual ants
    for (const ant of this.ants) {
      ant.update(this.world, this.pheromones, allAnts);
    }
  }
}
