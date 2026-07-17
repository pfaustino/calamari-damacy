/**
 * HUD / overlay helpers for title → play → result → present → cosmos → multiplayer.
 */
export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.sizeValue = document.getElementById('hud-size-value');
    this.sizeGoal = document.getElementById('hud-size-goal');
    this.timerValue = document.getElementById('hud-timer-value');
    this.stageName = document.getElementById('hud-stage-name');
    this.mpRosterHud = document.getElementById('hud-mp-roster');
    this.mpEventHud = document.getElementById('hud-mp-event');
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
    this.mpScreen = document.getElementById('mp-screen');
    this.mpResult = document.getElementById('mp-result-screen');
    this.pausePanel = 'main';
    this._eventTimer = 0;
  }

  hideAllOverlays() {
    this.title.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.result.classList.add('hidden');
    this.present.classList.add('hidden');
    this.cosmos.classList.add('hidden');
    this.mpScreen?.classList.add('hidden');
    this.mpResult?.classList.add('hidden');
    this.hud.classList.add('hidden');
  }

  showTitle() {
    this.hideAllOverlays();
    this.title.classList.remove('hidden');
  }

  showMpMenu() {
    this.hideAllOverlays();
    this.mpScreen.classList.remove('hidden');
    document.getElementById('mp-status').textContent = 'Host a room, or enter a code to join.';
    document.getElementById('mp-room-code').classList.add('hidden');
    document.getElementById('mp-roster').innerHTML = '';
    document.getElementById('btn-mp-start').classList.add('hidden');
    document.getElementById('btn-mp-host').classList.remove('hidden');
    document.getElementById('btn-mp-join').classList.remove('hidden');
  }

  showMpLobby({ status, roomCode, players, isHost, canStart = false }) {
    this.hideAllOverlays();
    this.mpScreen.classList.remove('hidden');
    document.getElementById('mp-status').textContent = status || '';
    const codeEl = document.getElementById('mp-room-code');
    if (roomCode) {
      codeEl.textContent = `Room code: ${roomCode}`;
      codeEl.classList.remove('hidden');
    } else {
      codeEl.classList.add('hidden');
    }
    const roster = document.getElementById('mp-roster');
    roster.innerHTML = '';
    for (const p of players || []) {
      const row = document.createElement('div');
      row.className = 'mp-roster-row';
      const swatch = document.createElement('span');
      swatch.className = 'mp-swatch';
      swatch.style.background = `#${(p.color >>> 0).toString(16).padStart(6, '0')}`;
      row.appendChild(swatch);
      const label = document.createElement('span');
      label.textContent = `${p.name}${p.you ? ' (you)' : ''}${isHost && p.you ? ' · host' : ''}`;
      row.appendChild(label);
      roster.appendChild(row);
    }
    document.getElementById('btn-mp-start').classList.toggle('hidden', !canStart);
    document.getElementById('btn-mp-host').classList.toggle('hidden', Boolean(roomCode));
    document.getElementById('btn-mp-join').classList.toggle('hidden', Boolean(roomCode));
  }

  showMpResult({ youWon, reason, rankings, stageName }) {
    this.hideAllOverlays();
    this.mpResult.classList.remove('hidden');
    document.getElementById('mp-result-title').textContent = youWon ? 'You win!' : 'Match over';
    const why =
      reason === 'goal'
        ? 'First to the size goal.'
        : 'Time up — biggest calamari wins.';
    document.getElementById('mp-result-message').textContent =
      `${why} (${stageName || 'Arena'})`;
    const box = document.getElementById('mp-result-rankings');
    box.innerHTML = '';
    (rankings || []).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = `mp-rank-row${r.you ? ' you' : ''}`;
      row.textContent = `${i + 1}. ${r.name} — ${r.sizeCm} cm · ${r.count} objects`;
      box.appendChild(row);
    });
  }

  flashMpEvent(text) {
    if (!this.mpEventHud) return;
    this.mpEventHud.textContent = text;
    this.mpEventHud.classList.remove('hidden');
    clearTimeout(this._eventTimer);
    this._eventTimer = setTimeout(() => {
      this.mpEventHud.classList.add('hidden');
    }, 2200);
  }

  showPlaying(stage, opts = {}) {
    this.hideAllOverlays();
    this.hud.classList.remove('hidden');
    if (stage.mode === 'collect') {
      const label = stage.collectType ?? 'item';
      this.sizeGoal.textContent = `Collect ${stage.collectGoal} ${label}s`;
    } else {
      this.sizeGoal.textContent = `Goal ${stage.goalCm} cm`;
    }
    this.stageName.textContent = opts.multiplayer
      ? `${stage.name} · Race & Battle`
      : stage.name;
    if (this.mpRosterHud) {
      this.mpRosterHud.classList.toggle('hidden', !opts.multiplayer);
      this.mpRosterHud.innerHTML = '';
    }
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

  showResult({
    won,
    sizeCm,
    goalCm,
    count,
    collectCount = 0,
    collectGoal = 0,
    collectType = 'item',
    mode = 'size',
    timeLeft,
    stageName,
    kingLine,
  }) {
    this.hideAllOverlays();
    this.result.classList.remove('hidden');
    if (won) {
      this.resultTitle.textContent = 'Mission complete!';
      this.resultMessage.textContent =
        mode === 'collect'
          ? `${kingLine} You scooped ${collectCount} ${collectType}s in ${stageName}.`
          : `${kingLine} You rolled a ${sizeCm} cm calamari in ${stageName}.`;
      this.resultPrimary.textContent = 'Present to the King';
    } else {
      this.resultTitle.textContent = mode === 'collect' ? 'Not enough…' : 'Too small…';
      this.resultMessage.textContent =
        timeLeft <= 0
          ? kingLine
          : mode === 'collect'
            ? `Keep hunting ${collectType}s.`
            : 'Keep rolling — anything smaller than you sticks.';
      this.resultPrimary.textContent = 'Try Again';
    }
    this.resultStats.textContent =
      mode === 'collect'
        ? `${collectCount}/${collectGoal} ${collectType}s · ${sizeCm} cm · ${count} objects`
        : `${sizeCm} cm · ${count} objects · goal ${goalCm} cm`;
  }

  showPresent({ starName, kingPraise, sizeCm, count }) {
    this.hideAllOverlays();
    this.present.classList.remove('hidden');
    this.presentStarName.textContent = starName;
    this.presentMessage.textContent = kingPraise;
    this.presentStats.textContent = `${sizeCm} cm · ${count} objects → a star`;
    this.risingStar.classList.remove('rise');
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
            ? stage.mode === 'collect'
              ? `${stage.blurb} · Collect ${stage.collectGoal} ${stage.collectType}s`
              : `${stage.blurb} · Goal ${stage.goalCm} cm`
            : 'Locked — clear the previous mission'
        }</span>
      `;
      if (unlocked) {
        btn.addEventListener('click', () => onSelect(stage.id));
      }
      this.stageList.appendChild(btn);
    }
  }

  updateHud(sizeCm, timeSec, mission = {}) {
    this.sizeValue.textContent = `${sizeCm} cm`;
    if (mission.mode === 'collect') {
      const n = mission.collectCount ?? 0;
      const goal = mission.collectGoal ?? 0;
      const label = mission.collectType ?? 'item';
      this.sizeGoal.textContent = `${label}s ${n}/${goal}`;
    }
    const m = Math.floor(timeSec / 60);
    const s = Math.floor(timeSec % 60);
    this.timerValue.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    if (timeSec < 30) this.timerValue.style.color = '#ff6b6b';
    else this.timerValue.style.color = '';

    if (this.mpRosterHud && mission.multiplayer && mission.roster) {
      this.mpRosterHud.classList.remove('hidden');
      this.mpRosterHud.innerHTML = mission.roster
        .map(
          (r) =>
            `<span class="hud-mp-chip${r.you ? ' you' : ''}">${r.name} ${r.sizeCm}cm</span>`,
        )
        .join('');
    }
  }
}
