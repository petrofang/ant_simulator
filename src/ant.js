'use strict';

const AntState = Object.freeze({
  WANDERING: 0,   // foraging without a trail to follow
  FOLLOWING: 1,   // following a pheromone trail toward food
  CARRYING:  2,   // carrying food, heading home
  FIGHTING:  3,
  GUARDING:  4,   // soldier patrolling near nest
  // Developmental stages (immature)
  EGG:       5,
  LARVA:     6,
  PUPA:      7,
  DEAD:      8,
});

const AntType = Object.freeze({
  WORKER:  0,
  SOLDIER: 1,
  QUEEN:   2,
});

class Ant {
  constructor(x, y, type, colony) {
    this.x      = x;
    this.y      = y;
    this.type   = type;
    this.colony = colony; // 0 = black, 1 = red
    this.dir    = Math.random() * Math.PI * 2;
    this.state  = (type === AntType.QUEEN) ? AntState.GUARDING : AntState.WANDERING;

    this.hp     = this._maxHpForType(type);
    this.maxHp  = this.hp;

    this.carrying      = 0;   // food being carried
    this.devTicks      = 0;   // ticks spent in developmental stage
    this.fightCooldown = 0;
    this.hitFlash      = 0;   // frames remaining for hit-flash visual
    this.legPhase      = 0;   // animated leg swing phase (radians)
    this.kills         = 0;   // enemies killed

    this.isPlayer  = false;
    this.nestX     = x;  // home nest centre (set by Colony)
    this.nestY     = y;
  }

  _maxHpForType(type) {
    if (type === AntType.QUEEN)   return CONFIG.QUEEN_HP;
    if (type === AntType.SOLDIER) return CONFIG.SOLDIER_HP;
    return CONFIG.WORKER_HP;
  }

  get isMature() { return this.state < AntState.EGG; }
  get isDead()   { return this.state === AntState.DEAD; }

  static createEgg(x, y, colony) {
    const e  = new Ant(x, y, AntType.WORKER, colony);
    e.state   = AntState.EGG;
    e.devTicks = 0;
    return e;
  }

  // Advance developmental stages
  develop() {
    this.devTicks++;
    if (this.state === AntState.EGG   && this.devTicks >= CONFIG.EGG_TICKS) {
      this.state = AntState.LARVA;  this.devTicks = 0;
    } else if (this.state === AntState.LARVA && this.devTicks >= CONFIG.LARVA_TICKS) {
      this.state = AntState.PUPA;
      this.devTicks = 0;
      // 25 % chance to become a soldier
      this.type = (Math.random() < 0.25) ? AntType.SOLDIER : AntType.WORKER;
    } else if (this.state === AntState.PUPA  && this.devTicks >= CONFIG.PUPA_TICKS) {
      this.state = AntState.WANDERING;
      this.hp = this.maxHp = this._maxHpForType(this.type);
    }
  }

  update(world, pheromones, allAnts) {
    if (!this.isMature)               { this.develop(); return; }
    if (this.isDead)                  { return; }
    if (this.type === AntType.QUEEN)  { return; }  // queen is stationary

    if (this.fightCooldown > 0) this.fightCooldown--;
    if (this.hitFlash      > 0) this.hitFlash--;

    // Always check for nearby enemies first
    const enemy = this._findEnemy(allAnts);
    if (enemy) {
      this._attackEnemy(enemy);
      return;
    }

    // Return to non-fighting state after losing target
    if (this.state === AntState.FIGHTING) {
      this.state = (this.carrying > 0) ? AntState.CARRYING : AntState.WANDERING;
    }

    switch (this.state) {
      case AntState.WANDERING:
      case AntState.FOLLOWING:
        this._forage(world, pheromones);
        break;
      case AntState.CARRYING:
        this._returnHome(world, pheromones);
        break;
      case AntState.GUARDING:
        this._guard();
        break;
    }

    this._move(world);
  }

  _forage(world, pheromones) {
    // Pick up food if standing on it
    if (world.hasFood(this.x, this.y)) {
      const taken = world.takeFood(this.x, this.y, 1);
      if (taken > 0) {
        this.carrying = taken;
        this.state    = AntState.CARRYING;
        // U-turn to head home
        this.dir += Math.PI + (Math.random() - 0.5) * 0.4;
        return;
      }
    }

    // Steer toward pheromone trail
    const steer = pheromones.steer(this.colony, this.x, this.y, this.dir);
    if (steer !== null && Math.random() > CONFIG.WANDER) {
      this.dir  += steer * CONFIG.TURN_MAX;
      this.state = AntState.FOLLOWING;
    } else {
      // Random walk
      this.dir  += (Math.random() - 0.5) * CONFIG.WANDER * 2.2;
      this.state = AntState.WANDERING;
    }
  }

  _returnHome(world, pheromones) {
    // Deposit trail pheromone while carrying food home
    pheromones.deposit(this.colony, this.x, this.y, CONFIG.PHERO_DEPOSIT);

    // Reached nest — deposit food (Colony.update collects it)
    if (world.isNest(this.x, this.y)) {
      // Colony.update will pick up ant.carrying
      this.state = AntState.WANDERING;
      this.dir  += Math.PI + (Math.random() - 0.5) * 0.6;
      return;
    }

    // Steer toward home nest center with slight randomness
    const dx   = this.nestX - this.x;
    const dy   = this.nestY - this.y;
    const home = Math.atan2(dy, dx);
    this.dir   = home + (Math.random() - 0.5) * 0.35;
  }

  _guard() {
    this.dir += (Math.random() - 0.5) * 0.7;
  }

  _findEnemy(allAnts) {
    const r2 = CONFIG.DETECT_RANGE * CONFIG.DETECT_RANGE;
    for (const other of allAnts) {
      if (other.colony === this.colony) continue;
      if (!other.isMature || other.isDead) continue;
      const dx = other.x - this.x, dy = other.y - this.y;
      if (dx * dx + dy * dy <= r2) return other;
    }
    return null;
  }

  _attackEnemy(enemy) {
    this.state = AntState.FIGHTING;
    // Face enemy and close the distance
    const dx   = enemy.x - this.x;
    const dy   = enemy.y - this.y;
    this.dir   = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > CONFIG.FIGHT_RANGE) {
      this._move(null); // move toward enemy (no obstacle check for fighting)
    } else if (this.fightCooldown <= 0) {
      enemy.hp -= CONFIG.DAMAGE;
      enemy.hitFlash = 10;
      this.fightCooldown = CONFIG.FIGHT_COOLDOWN;
      if (enemy.hp <= 0) { enemy.state = AntState.DEAD; this.kills++; }
    }
  }

  _move(world) {
    const spd = this.isPlayer ? CONFIG.PLAYER_SPEED : CONFIG.SPEED;
    let nx = this.x + Math.cos(this.dir) * spd;
    let ny = this.y + Math.sin(this.dir) * spd;

    // Bounce off borders
    if (nx < 0 || nx >= CONFIG.COLS) {
      this.dir = Math.PI - this.dir;
      nx = Math.max(0.1, Math.min(CONFIG.COLS - 0.1, nx));
    }
    if (ny < 0 || ny >= CONFIG.ROWS) {
      this.dir = -this.dir;
      ny = Math.max(0.1, Math.min(CONFIG.ROWS - 0.1, ny));
    }

    // Avoid obstacles (if world is provided)
    if (world && !world.passable(Math.floor(nx), Math.floor(ny))) {
      this.dir += Math.PI / 2 + (Math.random() - 0.5) * 1.0;
      return; // stay in place this tick
    }

    this.x = nx;
    this.y = ny;
    this.legPhase += spd * 12; // advance leg animation
  }
}
