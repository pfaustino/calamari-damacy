import { Katamari } from './Katamari.js';
import { NetSession, MP_COLORS, MAX_PLAYERS } from './NetSession.js';

/**
 * Online race + battle: host simulates; guests send input and apply snapshots.
 * Win: first to size goal, else biggest when time expires. Bump steals volume.
 */
export class Multiplayer {
  /** @param {import('./Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.net = new NetSession();
    /** @type {'idle' | 'lobby' | 'playing' | 'ended'} */
    this.phase = 'idle';
    /** @type {{ id: string, name: string, color: number, wish: {x:number,z:number}, ball: import('./Katamari.js').Katamari | null }[]} */
    this.players = [];
    this.localId = null;
    this.roomCode = null;
    this.isHost = false;
    this.stageId = null;
    this._stateAcc = 0;
    this._removedProps = [];
    this._events = [];
    this._status = '';
    this._inputAcc = 0;
  }

  get localPlayer() {
    return this.players.find((p) => p.id === this.localId) ?? null;
  }

  get localBall() {
    return this.localPlayer?.ball ?? null;
  }

  async createLobby(name) {
    this.phase = 'lobby';
    this._status = 'Connecting…';
    this.game.ui.showMpLobby({ status: this._status, roomCode: null, players: [], isHost: true });

    const profile = { name: name || 'Prince', color: MP_COLORS[0] };
    try {
      const { roomCode, localId } = await this.net.host(profile);
      this.roomCode = roomCode;
      this.localId = localId;
      this.isHost = true;
      this.players = [{ id: localId, name: profile.name, color: profile.color, wish: { x: 0, z: 0 }, ball: null }];
      this._wireNet();
      this._status = 'Share the room code. Start when ready.';
      this._refreshLobby();
    } catch (e) {
      this._status = `Host failed: ${e.message || e}`;
      this.game.ui.showMpLobby({ status: this._status, roomCode: null, players: [], isHost: true });
    }
  }

  async joinLobby(code, name) {
    this.phase = 'lobby';
    this._status = 'Joining…';
    this.game.ui.showMpLobby({ status: this._status, roomCode: code, players: [], isHost: false });

    const color = MP_COLORS[1];
    const profile = { name: name || 'Prince', color };
    try {
      const { roomCode, localId } = await this.net.join(code, profile);
      this.roomCode = roomCode;
      this.localId = localId;
      this.isHost = false;
      this.players = [];
      this._wireNet();
      this._status = 'Waiting for host to start…';
      this._refreshLobby();
    } catch (e) {
      this._status = `Join failed: ${e.message || e}`;
      this.game.ui.showMpLobby({ status: this._status, roomCode: code, players: [], isHost: false });
    }
  }

  _wireNet() {
    this.net.on('message', ({ from, msg }) => this._onMessage(from, msg));
    this.net.on('peer', ({ peerId, joined }) => {
      if (!this.isHost) return;
      if (!joined) {
        this.players = this.players.filter((p) => p.id !== peerId);
        this._broadcastLobby();
        this._refreshLobby();
      }
    });
    this.net.on('error', ({ message }) => {
      this._status = message;
      if (this.phase === 'lobby') this._refreshLobby();
    });
  }

  _onMessage(from, msg) {
    if (msg.type === 'hello' && this.isHost && this.phase === 'lobby') {
      if (this.players.length >= MAX_PLAYERS) {
        this.net.sendTo(from, { type: 'reject', reason: 'Room full' });
        return;
      }
      const color = MP_COLORS[this.players.length % MP_COLORS.length];
      const name = msg.profile?.name || 'Prince';
      this.players.push({
        id: from,
        name,
        color: msg.profile?.color ?? color,
        wish: { x: 0, z: 0 },
        ball: null,
      });
      this.net.sendTo(from, {
        type: 'welcome',
        yourId: from,
        players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
        roomCode: this.roomCode,
      });
      this._broadcastLobby();
      this._refreshLobby();
      return;
    }

    if (msg.type === 'welcome' && !this.isHost) {
      this.localId = msg.yourId || this.localId;
      this.players = (msg.players || []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        wish: { x: 0, z: 0 },
        ball: null,
      }));
      this._status = 'Waiting for host to start…';
      this._refreshLobby();
      return;
    }

    if (msg.type === 'lobby' && !this.isHost) {
      this.players = (msg.players || []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        wish: { x: 0, z: 0 },
        ball: null,
      }));
      this._refreshLobby();
      return;
    }

    if (msg.type === 'reject') {
      this._status = msg.reason || 'Rejected';
      this._refreshLobby();
      return;
    }

    if (msg.type === 'start') {
      this._beginMatch(msg);
      return;
    }

    if (msg.type === 'input' && this.isHost && this.phase === 'playing') {
      const p = this.players.find((pl) => pl.id === from);
      if (p && msg.wish) p.wish = { x: msg.wish.x || 0, z: msg.wish.z || 0 };
      return;
    }

    if (msg.type === 'state' && !this.isHost && this.phase === 'playing') {
      this._applyState(msg);
      return;
    }

    if (msg.type === 'end') {
      this._finish(msg);
    }
  }

  _broadcastLobby() {
    this.net.send({
      type: 'lobby',
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    });
  }

  _refreshLobby() {
    this.game.ui.showMpLobby({
      status: this._status,
      roomCode: this.roomCode,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        you: p.id === this.localId,
      })),
      isHost: this.isHost,
      canStart: this.isHost && this.players.length >= 2,
    });
  }

  /** Host starts the match on a size-mode stage. */
  startMatch() {
    if (!this.isHost || this.players.length < 2) return;
    const stage =
      this.game.stages.find((s) => (s.mode ?? 'size') === 'size') ?? this.game.stages[0];
    const payload = {
      type: 'start',
      stageId: stage.id,
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    };
    this.net.send(payload);
    this._beginMatch(payload);
  }

  _beginMatch(msg) {
    const stage = this.game.stages.find((s) => s.id === msg.stageId) ?? this.game.stages[0];
    this.stageId = stage.id;
    this.phase = 'playing';
    this._removedProps = [];
    this._events = [];
    this._stateAcc = 0;

    this.players = (msg.players || this.players).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      wish: { x: 0, z: 0 },
      ball: null,
    }));

    this.game.beginMultiplayerStage(stage, this.players);
  }

  /** Called by Game after balls are created. */
  attachBalls(ballsById) {
    for (const p of this.players) {
      p.ball = ballsById[p.id] ?? null;
    }
  }

  /** Host: prop scooped — queue id for clients. */
  onPropRemoved(propId) {
    if (!this.isHost) return;
    this._removedProps.push(propId);
  }

  onBumpSteal(attackerName, victimName, cm) {
    const text = `${attackerName} stole ${cm}cm from ${victimName}!`;
    this._events.push({ kind: 'steal', text });
    this.game.ui.flashMpEvent?.(text);
  }

  /**
   * @param {number} dt
   * @param {{ x: number, z: number }} localWish camera-relative already converted to world
   */
  update(dt, localWish) {
    if (this.phase !== 'playing') return;

    const local = this.localPlayer;
    if (local) local.wish = localWish;

    if (!this.isHost) {
      this._inputAcc += dt;
      if (this._inputAcc >= 1 / 20) {
        this._inputAcc = 0;
        this.net.send({ type: 'input', wish: localWish });
      }
      return;
    }

    // Host simulation
    const balls = this.players.map((p) => p.ball).filter(Boolean);
    for (const p of this.players) {
      if (!p.ball) continue;
      p.ball.update(dt, p.wish);
    }

    this.game.collectibles.update(dt, balls, {
      onScoop: (propId, type, ball) => {
        this.onPropRemoved(propId);
        this.game.audio?.shlurp(type.size);
        const owner = this.players.find((pl) => pl.ball === ball);
        if (owner) this.game.onMpCollected?.(owner.id, type);
      },
    });

    this._resolveBallBall();

    this.game.timeLeft -= dt;

    // Race win: first to goal
    const goal = this.game.stage.goalCm || 40;
    for (const p of this.players) {
      if (p.ball && p.ball.diameterCm >= goal) {
        this._endMatch(p.id, 'goal');
        return;
      }
    }
    if (this.game.timeLeft <= 0) {
      let best = this.players[0];
      for (const p of this.players) {
        if ((p.ball?.diameterCm ?? 0) > (best.ball?.diameterCm ?? 0)) best = p;
      }
      this._endMatch(best.id, 'time');
      return;
    }

    this._stateAcc += dt;
    if (this._stateAcc >= 1 / 15) {
      this._stateAcc = 0;
      this._broadcastState();
    }
  }

  _resolveBallBall() {
    const e = this.game.tuning.bonkRestitution ?? 0.55;
    const list = this.players.filter((p) => p.ball);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i].ball;
        const b = list[j].ball;
        let dx = b.position.x - a.position.x;
        let dz = b.position.z - a.position.z;
        let dist = Math.hypot(dx, dz);
        const reach = a.radius + b.radius;
        if (dist >= reach || dist < 1e-6) {
          if (dist < 1e-6) {
            dx = 1;
            dz = 0;
            dist = 1;
          } else continue;
        }
        const nx = dx / dist;
        const nz = dz / dist;
        const mA = Math.max(0.4, a.collisionMass);
        const mB = Math.max(0.4, b.collisionMass);
        const inv = 1 / mA + 1 / mB;
        const overlap = reach - dist + 0.01;
        a.position.x -= nx * overlap * ((1 / mA) / inv);
        a.position.z -= nz * overlap * ((1 / mA) / inv);
        b.position.x += nx * overlap * ((1 / mB) / inv);
        b.position.z += nz * overlap * ((1 / mB) / inv);
        a.group.position.x = a.position.x;
        a.group.position.z = a.position.z;
        b.group.position.x = b.position.x;
        b.group.position.z = b.position.z;

        const rvx = a.velocity.x - b.velocity.x;
        const rvz = a.velocity.z - b.velocity.z;
        const velAlong = rvx * nx + rvz * nz;
        if (velAlong > 0) {
          const jImp = ((1 + e) * velAlong) / inv;
          a.velocity.x -= (jImp / mA) * nx;
          a.velocity.z -= (jImp / mA) * nz;
          b.velocity.x += (jImp / mB) * nx;
          b.velocity.z += (jImp / mB) * nz;
          this.game.audio?.bonk(Math.min(1.5, velAlong / 5));
        }

        // Steal: larger ball takes volume when impact is solid
        const impact = Math.abs(velAlong);
        if (impact > 2.2) {
          const bigger = a.radius >= b.radius ? list[i] : list[j];
          const smaller = bigger === list[i] ? list[j] : list[i];
          // Need meaningful size edge OR equal-ish brawl with high impact
          const ratio = bigger.ball.radius / Math.max(0.01, smaller.ball.radius);
          if (ratio >= 0.92) {
            const stealV = Math.min(
              smaller.ball.volume * 0.08,
              bigger.ball.volume * 0.05,
              0.35,
            );
            if (stealV > 0.02) {
              const before = smaller.ball.diameterCm;
              smaller.ball.removeVolume(stealV);
              bigger.ball.addVolume(stealV);
              const cm = Math.max(1, before - smaller.ball.diameterCm);
              this.onBumpSteal(bigger.name, smaller.name, cm);
            }
          }
        }
      }
    }
  }

  _broadcastState() {
    const removed = this._removedProps.splice(0, this._removedProps.length);
    const events = this._events.splice(0, this._events.length);
    this.net.send({
      type: 'state',
      timeLeft: this.game.timeLeft,
      removed,
      events,
      players: this.players.map((p) => ({
        id: p.id,
        x: p.ball?.position.x ?? 0,
        z: p.ball?.position.z ?? 0,
        vx: p.ball?.velocity.x ?? 0,
        vz: p.ball?.velocity.z ?? 0,
        radius: p.ball?.radius ?? 0.5,
        volume: p.ball?.volume ?? 0.125,
        count: p.ball?.count ?? 0,
        y: p.ball?.position.y ?? 0.5,
      })),
    });
  }

  _applyState(msg) {
    this.game.timeLeft = msg.timeLeft;
    if (msg.removed?.length) {
      this.game.collectibles.removeByIds(msg.removed);
    }
    for (const ev of msg.events || []) {
      if (ev.kind === 'steal') this.game.ui.flashMpEvent?.(ev.text);
    }
    for (const snap of msg.players || []) {
      const p = this.players.find((pl) => pl.id === snap.id);
      if (!p?.ball) continue;
      p.ball.applyNetState(snap);
    }
  }

  _endMatch(winnerId, reason) {
    if (this.phase !== 'playing') return;
    this.phase = 'ended';
    const rankings = [...this.players]
      .map((p) => ({
        id: p.id,
        name: p.name,
        sizeCm: p.ball?.diameterCm ?? 0,
        count: p.ball?.count ?? 0,
        you: p.id === this.localId,
      }))
      .sort((a, b) => b.sizeCm - a.sizeCm);
    const payload = { type: 'end', winnerId, reason, rankings };
    if (this.isHost) this.net.send(payload);
    this._finish(payload);
  }

  _finish(msg) {
    this.phase = 'ended';
    this.game.endMultiplayer(msg);
  }

  async leave() {
    await this.net.destroy();
    this.phase = 'idle';
    this.players = [];
    this.localId = null;
    this.roomCode = null;
  }
}
