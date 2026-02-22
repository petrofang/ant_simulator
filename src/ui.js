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
      speedVal:      document.getElementById('speed-value'),
      playerHpBar:   document.getElementById('player-hp-bar'),
      playerHpText:  document.getElementById('player-hp-text'),
      playerState:   document.getElementById('player-state'),
      killCount:     document.getElementById('kill-count'),
      // Economy dashboard
      blackFoodRate: document.getElementById('black-food-rate'),
      casteWorkers:  document.getElementById('caste-workers'),
      casteSoldiers: document.getElementById('caste-soldiers'),
      casteDev:      document.getElementById('caste-dev'),
      popSparkline:  document.getElementById('pop-sparkline'),
    };
  }

  update(blackColony, redColony, tick, playerAnt, kills) {
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

    if (kills !== undefined && e.killCount)  e.killCount.textContent  = kills;

    // Player ant status
    if (playerAnt && !playerAnt.isDead) {
      const pct = playerAnt.hp / playerAnt.maxHp * 100;
      if (e.playerHpBar)  e.playerHpBar.style.width  = `${pct}%`;
      if (e.playerHpText) e.playerHpText.textContent  = `${playerAnt.hp}/${playerAnt.maxHp}`;
      if (e.playerState) {
        const stateNames = ['Foraging','Following trail','Carrying food','Fighting!','Guarding','Alarmed!'];
        e.playerState.textContent = stateNames[playerAnt.state] ?? '';
      }
    } else if (e.playerState) {
      e.playerState.textContent = 'Reassigning…';
    }

    // Economy dashboard (black colony only)
    if (blackColony) {
      const w  = blackColony.workers;
      const s  = blackColony.soldiers;
      const d  = blackColony.developing;
      const total = w + s + d || 1;
      if (e.casteWorkers)  e.casteWorkers.style.width  = `${(w / total * 100).toFixed(1)}%`;
      if (e.casteSoldiers) e.casteSoldiers.style.width = `${(s / total * 100).toFixed(1)}%`;
      if (e.casteDev)      e.casteDev.style.width      = `${(d / total * 100).toFixed(1)}%`;
      if (e.blackFoodRate) {
        const r = blackColony.foodRate;
        e.blackFoodRate.textContent = r > 0 ? `+${r.toFixed(0)}` : '0';
      }
      if (e.popSparkline && blackColony.popHistory.length > 1) {
        this._drawSparkline(e.popSparkline, blackColony.popHistory);
      }
    }
  }

  setSpeed(mult) {
    if (this._el.speedVal) this._el.speedVal.textContent = `${mult}×`;
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

  _drawSparkline(canvas, data) {
    const ctx  = canvas.getContext('2d');
    const w    = canvas.width;
    const h    = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const max  = Math.max(...data, 1);
    const step = w / (data.length - 1);

    // Gradient fill under the line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 3) - 1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo((data.length - 1) * step, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(68,170,255,0.13)';
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = h - (v / max) * (h - 3) - 1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth   = 1.2;
    ctx.stroke();
  }
}
