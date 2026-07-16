import * as THREE from 'three';
import { createRng, pickWeighted } from './rng.js';

function makeGeometry(shape, size) {
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(size * 0.5, 12, 10);
    case 'cylinder':
      return new THREE.CylinderGeometry(size * 0.28, size * 0.28, size * 0.9, 12);
    case 'star':
      return new THREE.OctahedronGeometry(size * 0.45, 0);
    case 'box':
    default:
      return new THREE.BoxGeometry(size * 0.85, size * 0.55, size * 0.7);
  }
}

/**
 * Floor props: scoop if small enough, otherwise mass-based bonk collision.
 * Lighter body takes more of the bounce (equal-opposite impulse / mass).
 */
export class Collectibles {
  /** @param {import('./Game.js').Game} game */
  constructor(game) {
    this.game = game;
    /** @type {{ mesh: THREE.Mesh, type: object, vx: number, vz: number }[]} */
    this.items = [];
    this.root = new THREE.Group();
    game.scene.add(this.root);
  }

  spawn() {
    this.clear();
    const { stage, objectTypes } = this.game;
    const rng = createRng(stage.seed);
    const half = stage.floorSize * 0.5 - 2;

    for (let i = 0; i < stage.spawnCount; i++) {
      const type = pickWeighted(rng, objectTypes);
      const geo = makeGeometry(type.shape, type.size);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(type.color),
        roughness: 0.65,
        metalness: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const x = (rng() * 2 - 1) * half;
      const z = (rng() * 2 - 1) * half;
      if (Math.hypot(x, z) < 2.5) {
        i -= 1;
        continue;
      }
      mesh.position.set(x, type.size * 0.35, z);
      mesh.rotation.y = rng() * Math.PI * 2;
      mesh.userData.typeId = type.id;
      mesh.userData.size = type.size;
      mesh.userData.alive = true;

      this.root.add(mesh);
      this.items.push({ mesh, type, vx: 0, vz: 0 });
    }
  }

  clear() {
    for (const { mesh } of this.items) {
      mesh.geometry?.dispose();
      mesh.material?.dispose();
      mesh.removeFromParent();
    }
    this.items.length = 0;
  }

  /**
   * Slide loose props, then scoop or bonk against the ball.
   * @param {number} dt
   * @param {import('./Katamari.js').Katamari} ball
   */
  update(dt, ball) {
    const { objectFriction = 2.8, wallBounce = 0.4 } = this.game.tuning;
    const half = this.game.stage.floorSize * 0.5 - 0.5;
    const damp = Math.exp(-objectFriction * dt);

    for (const item of this.items) {
      if (!item.mesh.userData.alive) continue;
      item.vx *= damp;
      item.vz *= damp;
      if (item.vx * item.vx + item.vz * item.vz < 1e-6) {
        item.vx = 0;
        item.vz = 0;
        continue;
      }

      item.mesh.position.x += item.vx * dt;
      item.mesh.position.z += item.vz * dt;

      if (item.mesh.position.x > half) {
        item.mesh.position.x = half;
        item.vx *= -wallBounce;
      } else if (item.mesh.position.x < -half) {
        item.mesh.position.x = -half;
        item.vx *= -wallBounce;
      }
      if (item.mesh.position.z > half) {
        item.mesh.position.z = half;
        item.vz *= -wallBounce;
      } else if (item.mesh.position.z < -half) {
        item.mesh.position.z = -half;
        item.vz *= -wallBounce;
      }
    }

    this._resolveBall(ball);
  }

  /**
   * @param {import('./Katamari.js').Katamari} ball
   */
  _resolveBall(ball) {
    const maxPick = ball.pickupSize;
    const br = ball.radius;
    const mBall = Math.max(0.2, ball.mass);
    const e = this.game.tuning.bonkRestitution ?? 0.55;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (!item.mesh.userData.alive) continue;

      const mx = item.mesh.position.x;
      const mz = item.mesh.position.z;
      const objR = item.type.size * 0.45;
      const reach = br + objR;
      let dx = mx - ball.position.x;
      let dz = mz - ball.position.z;
      let distSq = dx * dx + dz * dz;
      if (distSq > reach * reach) continue;

      // Small enough → stick
      if (item.type.size <= maxPick) {
        item.mesh.userData.alive = false;
        this.items.splice(i, 1);
        ball.absorb(item.mesh, item.type);
        this.game.audio?.shlurp(item.type.size);
        continue;
      }

      // Too big → bonk (mass-weighted impulse)
      let dist = Math.sqrt(distSq);
      if (dist < 1e-5) {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a);
        dz = Math.sin(a);
        dist = 1;
      }
      const nx = dx / dist;
      const nz = dz / dist;

      const mObj = Math.max(0.15, item.type.mass);
      const invSum = 1 / mBall + 1 / mObj;

      // Positional separation (lighter body moves more)
      const overlap = reach - dist + 0.002;
      if (overlap > 0) {
        ball.position.x -= nx * overlap * ((1 / mBall) / invSum);
        ball.position.z -= nz * overlap * ((1 / mBall) / invSum);
        item.mesh.position.x += nx * overlap * ((1 / mObj) / invSum);
        item.mesh.position.z += nz * overlap * ((1 / mObj) / invSum);
        ball.group.position.x = ball.position.x;
        ball.group.position.z = ball.position.z;
      }

      // Relative velocity of ball vs object along normal (ball → object)
      const rvx = ball.velocity.x - item.vx;
      const rvz = ball.velocity.z - item.vz;
      const velAlong = rvx * nx + rvz * nz;
      // Approaching when ball moves toward object along n (velAlong > 0)
      if (velAlong <= 0) continue;

      const j = ((1 + e) * velAlong) / invSum;
      ball.velocity.x -= (j / mBall) * nx;
      ball.velocity.z -= (j / mBall) * nz;
      item.vx += (j / mObj) * nx;
      item.vz += (j / mObj) * nz;
      this.game.audio?.bonk(Math.min(1.4, velAlong / 6));
    }
  }
}
