import * as THREE from 'three';

/**
 * Third-person camera that eases behind the ball along travel direction.
 * Input is camera-relative; yaw only follows forward travel (not strafe/reverse).
 * Mouse wheel zooms in/out.
 */
export class FollowCamera {
  /** @param {import('./Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.yaw = 0;
    /** 1 = default; smaller = closer; larger = farther */
    this.zoom = 1;
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._onWheel = (e) => {
      e.preventDefault();
      const step = this.game.tuning.cameraZoomStep ?? 0.12;
      const min = this.game.tuning.cameraZoomMin ?? 0.45;
      const max = this.game.tuning.cameraZoomMax ?? 2.4;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.zoom = THREE.MathUtils.clamp(this.zoom + dir * step, min, max);
    };
  }

  init() {
    const canvas = document.getElementById('game-canvas');
    canvas?.addEventListener('wheel', this._onWheel, { passive: false });
  }

  reset() {
    this.yaw = 0;
    this.zoom = 1;
  }

  /**
   * @param {number} dt
   * @param {import('./Katamari.js').Katamari} ball
   * @param {{ x: number, z: number }} _wish
   */
  update(dt, ball, _wish) {
    const cam = this.game.camera;
    const { cameraDistance, cameraHeight, cameraLerp } = this.game.tuning;

    const spd = Math.hypot(ball.velocity.x, ball.velocity.z);
    if (spd > 0.5) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      // Only orbit behind when moving forward-ish — avoids A-spin and S-flip
      const forwardDot = (ball.velocity.x * fx + ball.velocity.z * fz) / spd;
      if (forwardDot > 0.2) {
        const targetYaw = Math.atan2(ball.velocity.x, ball.velocity.z);
        let diff = targetYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = 1 - Math.exp(-cameraLerp * dt);
        this.yaw += diff * turn;
      }
    }

    const dist = (cameraDistance + ball.radius * 2.2) * this.zoom;
    const height = (cameraHeight + ball.radius * 1.4) * this.zoom;

    this._desired.set(
      ball.position.x - Math.sin(this.yaw) * dist,
      ball.position.y + height,
      ball.position.z - Math.cos(this.yaw) * dist,
    );

    const t = 1 - Math.exp(-cameraLerp * dt);
    cam.position.lerp(this._desired, t);
    this._look.set(ball.position.x, ball.position.y + ball.radius * 0.3, ball.position.z);
    cam.lookAt(this._look);
  }

  /** Convert camera-relative wish (W forward / S back / A left / D right) into world XZ. */
  wishToWorld(wish) {
    if (wish.x === 0 && wish.z === 0) return wish;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);

    // W → z=-1 forward, S → z=+1 back; A → x=-1 left, D → x=+1 right
    const wx = -wish.z * fx + wish.x * rx;
    const wz = -wish.z * fz + wish.x * rz;
    const len = Math.hypot(wx, wz);
    if (len > 0) return { x: wx / len, z: wz / len };
    return { x: 0, z: 0 };
  }
}
