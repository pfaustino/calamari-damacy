/**
 * Simple HUD / overlay state machine helpers.
 */
export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.sizeValue = document.getElementById('hud-size-value');
    this.sizeGoal = document.getElementById('hud-size-goal');
    this.timerValue = document.getElementById('hud-timer-value');
    this.title = document.getElementById('title-screen');
    this.pause = document.getElementById('pause-screen');
    this.result = document.getElementById('result-screen');
    this.resultTitle = document.getElementById('result-title');
    this.resultMessage = document.getElementById('result-message');
    this.resultStats = document.getElementById('result-stats');
  }

  showTitle() {
    this.title.classList.remove('hidden');
    this.pause.classList.add('hidden');
    this.result.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showPlaying(goalCm) {
    this.title.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.result.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.sizeGoal.textContent = `Goal ${goalCm} cm`;
  }

  showPause() {
    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  showResult({ won, sizeCm, goalCm, count, timeLeft }) {
    this.result.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.pause.classList.add('hidden');
    if (won) {
      this.resultTitle.textContent = 'Fantastic!';
      this.resultMessage.textContent =
        'The King of the Cosmos is pleased with your sticky calamari.';
    } else {
      this.resultTitle.textContent = 'Too small…';
      this.resultMessage.textContent =
        timeLeft <= 0
          ? 'Time is up! Roll faster next time.'
          : 'Keep rolling — anything smaller than you sticks.';
    }
    this.resultStats.textContent = `${sizeCm} cm · ${count} objects · goal ${goalCm} cm`;
  }

  updateHud(sizeCm, timeSec) {
    this.sizeValue.textContent = `${sizeCm} cm`;
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    this.timerValue.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    if (timeSec < 30) this.timerValue.style.color = '#ff6b6b';
    else this.timerValue.style.color = '';
  }
}
