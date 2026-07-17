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
    /** @type {{ id: number, mesh: THREE.Mesh, type: object, vx: number, vz: number }[]} */
    this.items = [];
    /** @type {Map<number, { id: number, mesh: THREE.Mesh, type: object, vx: number, vz: number }>} */
    this.byId = new Map();
    this._nextId = 1;
    this.root = new THREE.Group();
    game.scene.add(this.root);
  }

  spawn() {
    this.clear();
    const { stage, objectTypes } = this.game;
    const rng = createRng(stage.seed);
    const half = stage.floorSize * 0.5 - 2;
    const isCollect = stage.mode === 'collect' && stage.collectType;
    const collectType = isCollect
      ? objectTypes.find((t) => t.id === stage.collectType)
      : null;
    const guaranteed =
      isCollect && collectType
        ? Math.max(stage.collectGoal * 2, stage.collectGoal + 8)
        : 0;

    const placeOne = (type) => {
      for (let tries = 0; tries < 40; tries++) {
        const x = (rng() * 2 - 1) * half;
        const z = (rng() * 2 - 1) * half;
        if (Math.hypot(x, z) < 2.5) continue;

        const geo = makeGeometry(type.shape, type.size);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(type.color),
          roughness: 0.65,
          metalness: 0.08,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(x, type.size * 0.35, z);
        mesh.rotation.y = rng() * Math.PI * 2;
        mesh.userData.typeId = type.id;
        mesh.userData.size = type.size;
        mesh.userData.alive = true;
        const id = this._nextId++;
        mesh.userData.propId = id;
        this.root.add(mesh);
        const item = { id, mesh, type, vx: 0, vz: 0 };
        this.items.push(item);
        this.byId.set(id, item);
        return true;
      }
      return false;
    };

    for (let i = 0; i < guaranteed; i++) placeOne(collectType);
    for (let i = 0; i < stage.spawnCount; i++) {
      placeOne(pickWeighted(rng, objectTypes));
    }
  }

  clear() {
    for (const { mesh } of this.items) {
      mesh.geometry?.dispose();
      mesh.material?.dispose();
      mesh.removeFromParent();
    }
    this.items.length = 0;
    this.byId.clear();
    this._nextId = 1;
  }

  /** Guest sync: remove scooped props by stable id. */
  removeByIds(ids) {
    for (const id of ids) {
      const item = this.byId.get(id);
      if (!item) continue;
      item.mesh.userData.alive = false;
      item.mesh.geometry?.dispose();
      item.mesh.material?.dispose();
      item.mesh.removeFromParent();
      this.byId.delete(id);
      const idx = this.items.indexOf(item);
      if (idx >= 0) this.items.splice(idx, 1);
    }
  }

  /**
   * Slide loose props, then scoop or bonk against one or more balls.
   * @param {number} dt
   * @param {import('./Katamari.js').Katamari | import('./Katamari.js').Katamari[]} ballOrBalls
   * @param {{ onScoop?: (propId: number, type: object, ball: import('./Katamari.js').Katamari) => void }=} opts
   */
  update(dt, ballOrBalls, opts = {}) {
    const balls = Array.isArray(ballOrBalls) ? ballOrBalls : [ballOrBalls];
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

    for (const ball of balls) {
      if (ball) this._resolveBall(ball, opts);
    }
  }

  /**
   * @param {import('./Katamari.js').Katamari} ball
   * @param {{ onScoop?: (propId: number, type: object, ball: import('./Katamari.js').Katamari) => void }} opts
   */
  _resolveBall(ball, opts = {}) {
    const maxPick = ball.pickupSize;
    const br = ball.radius;
    const mBall = Math.max(0.25, ball.collisionMass);
    const e = this.game.tuning.bonkRestitution ?? 0.55;
    const objScale = this.game.tuning.objectCollisionScale ?? 3.5;

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

      if (item.type.size <= maxPick) {
        item.mesh.userData.alive = false;
        const propId = item.id;
        const type = item.type;
        this.byId.delete(propId);
        this.items.splice(i, 1);
        ball.absorb(item.mesh, type);
        if (opts.onScoop) opts.onScoop(propId, type, ball);
        else {
          this.game.audio?.shlurp(type.size);
          this.game.onCollected?.(type);
        }
        continue;
      }

      let dist = Math.sqrt(distSq);
      if (dist < 1e-5) {
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a);
        dz = Math.sin(a);
        dist = 1;
      }
      const nx = dx / dist;
      const nz = dz / dist;

      const mObj = Math.max(0.5, item.type.mass * objScale + item.type.size * 1.2);
      const invSum = 1 / mBall + 1 / mObj;

      const overlap = reach - dist + 0.002;
      if (overlap > 0) {
        ball.position.x -= nx * overlap * ((1 / mBall) / invSum);
        ball.position.z -= nz * overlap * ((1 / mBall) / invSum);
        item.mesh.position.x += nx * overlap * ((1 / mObj) / invSum);
        item.mesh.position.z += nz * overlap * ((1 / mObj) / invSum);
        ball.group.position.x = ball.position.x;
        ball.group.position.z = ball.position.z;
      }

      const rvx = ball.velocity.x - item.vx;
      const rvz = ball.velocity.z - item.vz;
      const velAlong = rvx * nx + rvz * nz;
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
