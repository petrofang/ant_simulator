'use strict';

class UI {
  constructor() {
    this._el = {
      blackWorkers:  document.getElementById('black-workers'),
      blackSoldiers: document.getElementById('black-soldiers'),
      blackDev:      document.getElementById('black-developing'),
      blackFood:     document.getElementById('black-food'),
      blackQueen:    document.getElementById('black-queen'),
      redWorkers:    document.getElementById('red-workers'),
      redSoldiers:   document.getElementById('red-soldiers'),
      redDev:        document.getElementById('red-developing'),
      redQueen:      document.getElementById('red-queen'),
      status:        document.getElementById('status-text'),
      tick:          document.getElementById('tick-count'),
      message:       document.getElementById('message'),
    };
  }

  update(blackColony, redColony, tick) {
    const e = this._el;

    if (blackColony) {
      e.blackWorkers.textContent  = blackColony.workers;
      e.blackSoldiers.textContent = blackColony.soldiers;
      e.blackDev.textContent      = blackColony.developing;
      e.blackFood.textContent     = Math.floor(blackColony.food);
      e.blackQueen.textContent    = blackColony.alive ? '♛' : '✗';
    }
    if (redColony) {
      e.redWorkers.textContent    = redColony.workers;
      e.redSoldiers.textContent   = redColony.soldiers;
      e.redDev.textContent        = redColony.developing;
      e.redQueen.textContent      = redColony.alive ? '♛' : '✗';
    }
    e.tick.textContent = `Tick: ${tick}`;
  }

  showMessage(text, color = '#ffffff') {
    const m       = this._el.message;
    m.textContent = text;
    m.style.color = color;
    m.classList.remove('hidden');
  }

  hideMessage() {
    this._el.message.classList.add('hidden');
  }

  setStatus(text) {
    this._el.status.textContent = text;
  }
}
