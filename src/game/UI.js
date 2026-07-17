/**
 * HUD / overlay helpers for title → play → result → present → cosmos.
 */
export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.sizeValue = document.getElementById('hud-size-value');
    this.sizeGoal = document.getElementById('hud-size-goal');
    this.timerValue = document.getElementById('hud-timer-value');
    this.stageName = document.getElementById('hud-stage-name');
    this.title = document.getElementById('title-screen');
    this.pause = document.getElementById('pause-screen');
    this.result = document.getElementById('result-screen');
    this.resultTitle = document.getElementById('result-title');
    this.resultMessage = document.getElementById('result-message');
    this.resultStats = document.getElementById('result-stats');
    this.resultPrimary = document.getElementById('btn-result-primary');
    this.present = document.getElementById('present-screen');
    this.presentStarName = document.getElementById('present-star-name');
    this.presentMessage = document.getElementById('present-message');
    this.presentStats = document.getElementById('present-stats');
    this.risingStar = document.getElementById('rising-star');
    this.cosmos = document.getElementById('cosmos-screen');
    this.hungStars = document.getElementById('hung-stars');
    this.stageList = document.getElementById('stage-list');
    this.pausePanel = 'main';
  }

  hideAllOverlays() {
    this.title.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.result.classList.add('hidden');
    this.present.classList.add('hidden');
    this.cosmos.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showTitle() {
    this.hideAllOverlays();
    this.title.classList.remove('hidden');
  }

  showPlaying(stage) {
    this.hideAllOverlays();
    this.hud.classList.remove('hidden');
    this.sizeGoal.textContent = `Goal ${stage.goalCm} cm`;
    this.stageName.textContent = stage.name;
  }

  showPause() {
    this.pause.classList.remove('hidden');
    this.showPausePanel('main');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  /** @param {'main' | 'sound' | 'about'} panel */
  showPausePanel(panel) {
    document.getElementById('pause-main').classList.toggle('hidden', panel !== 'main');
    document.getElementById('pause-sound').classList.toggle('hidden', panel !== 'sound');
    document.getElementById('pause-about').classList.toggle('hidden', panel !== 'about');
    this.pausePanel = panel;
  }

  syncSoundSliders(musicPct, sfxPct) {
    const music = document.getElementById('slider-music');
    const sfx = document.getElementById('slider-sfx');
    const musicVal = document.getElementById('slider-music-val');
    const sfxVal = document.getElementById('slider-sfx-val');
    if (music) music.value = String(musicPct);
    if (sfx) sfx.value = String(sfxPct);
    if (musicVal) musicVal.textContent = `${musicPct}%`;
    if (sfxVal) sfxVal.textContent = `${sfxPct}%`;
  }

  showResult({ won, sizeCm, goalCm, count, timeLeft, stageName, kingLine }) {
    this.hideAllOverlays();
    this.result.classList.remove('hidden');
    if (won) {
      this.resultTitle.textContent = 'Mission complete!';
      this.resultMessage.textContent =
        `${kingLine} You rolled a ${sizeCm} cm calamari in ${stageName}.`;
      this.resultPrimary.textContent = 'Present to the King';
    } else {
      this.resultTitle.textContent = 'Too small…';
      this.resultMessage.textContent =
        timeLeft <= 0
          ? kingLine
          : 'Keep rolling — anything smaller than you sticks.';
      this.resultPrimary.textContent = 'Try Again';
    }
    this.resultStats.textContent = `${sizeCm} cm · ${count} objects · goal ${goalCm} cm`;
  }

  showPresent({ starName, kingPraise, sizeCm, count }) {
    this.hideAllOverlays();
    this.present.classList.remove('hidden');
    this.presentStarName.textContent = starName;
    this.presentMessage.textContent = kingPraise;
    this.presentStats.textContent = `${sizeCm} cm · ${count} objects → a star`;
    this.risingStar.classList.remove('rise');
    // Retrigger animation
    void this.risingStar.offsetWidth;
    this.risingStar.classList.add('rise');
  }

  /**
   * @param {object[]} stages
   * @param {{ completed: string[], stars: object[] }} progress
   * @param {(stageId: string) => boolean} isUnlocked
   * @param {(stageId: string) => void} onSelect
   */
  showCosmos(stages, progress, isUnlocked, onSelect) {
    this.hideAllOverlays();
    this.cosmos.classList.remove('hidden');

    this.hungStars.innerHTML = '';
    if (progress.stars.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'tagline';
      empty.style.margin = '0';
      empty.textContent = 'No stars yet. Complete a mission to hang one.';
      this.hungStars.appendChild(empty);
    } else {
      for (const star of progress.stars) {
        const chip = document.createElement('span');
        chip.className = 'hung-star-chip';
        chip.textContent = `${star.starName} (${star.sizeCm} cm)`;
        this.hungStars.appendChild(chip);
      }
    }

    this.stageList.innerHTML = '';
    for (const stage of stages) {
      const unlocked = isUnlocked(stage.id);
      const cleared = progress.completed.includes(stage.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `stage-card${cleared ? ' cleared' : ''}`;
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <span class="stage-card-name">${stage.name}</span>
        <span class="stage-card-meta">${
          unlocked
            ? `${stage.blurb} · Goal ${stage.goalCm} cm`
            : 'Locked — clear the previous mission'
        }</span>
      `;
      if (unlocked) {
        btn.addEventListener('click', () => onSelect(stage.id));
      }
      this.stageList.appendChild(btn);
    }
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
