import * as THREE from 'three';
import gameData from '../../data/game.json';
import stageData from '../../data/stage.json';
import objectsData from '../../data/objects.json';
import { Input } from './Input.js';
import { World } from './World.js';
import { Katamari } from './Katamari.js';
import { Collectibles } from './Collectibles.js';
import { FollowCamera } from './FollowCamera.js';
import { UI } from './UI.js';
import { AudioManager } from './AudioManager.js';
import { initDevPanel } from '../dev/DevPanel.js';

/** @typedef {'title' | 'playing' | 'paused' | 'result'} GameState */

/**
 * Thin orchestrator — wires systems and owns the state machine.
 */
export class Game {
  constructor() {
    this.state = /** @type {GameState} */ ('title');
    this.tuning = null;
    this.stage = null;
    this.objectTypes = [];

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    this.input = new Input();
    this.ui = new UI();
    this.world = null;
    this.ball = null;
    this.collectibles = null;
    this.followCam = null;
    this.audio = new AudioManager();

    this.timeLeft = 0;
    this._escWasDown = false;
    this._raf = 0;
  }

  init() {
    this.tuning = gameData.tuning;
    this.stage = stageData;
    this.objectTypes = objectsData.types;

    this.setupRenderer();
    this.setupScene();
    this.input.init();
    this.world = new World(this);
    this.world.init();
    this.collectibles = new Collectibles(this);
    this.followCam = new FollowCamera(this);
    this.audio.init();

    this.bindUi();
    this.ui.showTitle();

    initDevPanel({
      getStatus: () =>
        `${this.state} · ${this.ball?.diameterCm ?? 0}cm · ${this.collectibles?.items.length ?? 0} left`,
      actions: [
        { label: 'Win now', fn: () => this.endStage(true) },
        { label: 'Grow +10cm', fn: () => this.devGrow(10) },
        { label: 'Skip 30s', fn: () => { this.timeLeft = Math.max(0, this.timeLeft - 30); } },
        { label: 'Restart stage', fn: () => this.startStage() },
      ],
    });

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  setupRenderer() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 8, 12);
  }

  bindUi() {
    document.getElementById('btn-play').addEventListener('click', () => {
      this.audio.unlockAndPlay();
      this.startStage();
    });
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-quit').addEventListener('click', () => this.toTitle());
    document.getElementById('btn-retry').addEventListener('click', () => {
      this.audio.unlockAndPlay();
      this.startStage();
    });
    document.getElementById('btn-title').addEventListener('click', () => this.toTitle());
  }

  startStage() {
    if (this.ball) {
      this.scene.remove(this.ball.group);
      this.ball = null;
    }
    this.collectibles.clear();
    this.ball = new Katamari(this, this.stage.startRadius);
    this.collectibles.spawn();
    this.timeLeft = this.stage.timeLimit;
    this.followCam.yaw = 0;
    this.camera.position.set(0, 8, 12);
    this.state = 'playing';
    this.ui.showPlaying(this.stage.goalCm);
    this.clock.getDelta();
    this.audio.unduck();
    this.audio.play();
  }

  toTitle() {
    this.state = 'title';
    if (this.ball) {
      this.scene.remove(this.ball.group);
      this.ball = null;
    }
    this.collectibles?.clear();
    this.ui.showTitle();
    this.audio.stop();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showPause();
    this.audio.duck(0.3);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hidePause();
    this.clock.getDelta();
    this.audio.unduck();
    this.audio.play();
  }

  endStage(forceWin = false) {
    if (this.state !== 'playing' && !forceWin) return;
    const sizeCm = this.ball?.diameterCm ?? 0;
    const won = forceWin || sizeCm >= this.stage.goalCm;
    this.state = 'result';
    this.ui.showResult({
      won,
      sizeCm,
      goalCm: this.stage.goalCm,
      count: this.ball?.count ?? 0,
      timeLeft: this.timeLeft,
    });
    this.audio.duck(0.4);
  }

  devGrow(cm) {
    if (!this.ball) return;
    // diameter cm → radius world units (1 unit = 10 cm diameter scale: diameterCm = radius*20)
    const addRadius = cm / 20;
    this.ball.radius += addRadius;
    this.ball._syncScale();
    this.ball.position.y = this.ball.radius;
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate = () => {
    this._raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    const esc = this.input.isEscapePressed();
    if (esc && !this._escWasDown) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    this._escWasDown = esc;

    if (this.state === 'playing' && this.ball) {
      const wishLocal = this.input.getMoveVector();
      const wish = this.followCam.wishToWorld(wishLocal);
      this.ball.update(dt, wish);
      this.collectibles.update(dt, this.ball);
      this.followCam.update(dt, this.ball, wish);

      this.timeLeft -= dt;
      this.ui.updateHud(this.ball.diameterCm, Math.max(0, this.timeLeft));

      if (this.ball.diameterCm >= this.stage.goalCm) {
        this.endStage(true);
      } else if (this.timeLeft <= 0) {
        this.endStage(false);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
