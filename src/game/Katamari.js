import * as THREE from 'three';

/**
 * Sticky calamari ball — rolls, grows, parents collected meshes.
 *
 * Physics of stuck junk:
 * - Mass far from the center raises effective inertia (harder to shove / turn).
 * - Protrusions that sweep the floor add scrape drag (lumpy roll).
 * - As each object melts into the core, that lever-arm cost fades and radius grows.
 */
export class Katamari {
  /**
   * @param {import('./Game.js').Game} game
   * @param {number} startRadius
   */
  constructor(game, startRadius) {
    this.game = game;
    this.radius = startRadius;
    this.massCollected = 0;
    this.count = 0;
    /** @type {{ mesh: THREE.Object3D, mass: number, melt: number, growthLeft: number, baseScale: THREE.Vector3, dir: THREE.Vector3 }[]} */
    this.stuck = [];
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(0, startRadius, 0);

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    const geo = new THREE.SphereGeometry(1, 24, 18);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff6b8a,
      roughness: 0.45,
      metalness: 0.05,
      emissive: 0x3a1020,
      emissiveIntensity: 0.15,
    });
    this.core = new THREE.Mesh(geo, mat);
    this.core.castShadow = true;
    this.core.receiveShadow = true;
    this.group.add(this.core);

    const eyeGeo = new THREE.SphereGeometry(0.18, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.45, 0.35, 0.75);
      eye.scale.setScalar(0.55);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pupilMat);
      pupil.position.set(0, 0, 0.12);
      eye.add(pupil);
      this.core.add(eye);
    }

    this._syncScale();
    game.scene.add(this.group);

    this._tmp = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  }

  get diameterCm() {
    return Math.round(this.radius * 2 * 10);
  }

  get pickupSize() {
    return this.radius * this.game.tuning.pickupRatio;
  }

  /** Unmelted junk still hanging off the surface. */
  get protrudingMass() {
    let p = 0;
    for (const s of this.stuck) p += (1 - s.melt) * s.mass;
    return p;
  }

  /**
   * Only unmelted surface junk scrapes the floor.
   * Fades with melt and is exactly 0 once the object is gone (after meltDuration).
   */
  get scrapeMass() {
    let p = 0;
    for (const s of this.stuck) {
      const remain = 1 - s.melt;
      if (remain <= 0) continue;
      // Sinks inward while melting — stop scraping once below the shell
      const radial = 0.25 + 0.7 * remain;
      const stickOut = Math.max(0, (radial - 0.5) / 0.45);
      p += s.mass * stickOut;
    }
    return p;
  }

  /**
   * Full mass for bonks — bigger ball still hits harder.
   * Push uses a separate “feel” mass so growth doesn’t slow you down.
   */
  get mass() {
    const { baseMass, massPerRadius, protrusionInertia } = this.game.tuning;
    return (
      baseMass +
      this.radius * massPerRadius +
      this.protrudingMass * protrusionInertia
    );
  }

  /** Mass that resists steering — growth & junk don't throttle the pusher. */
  get pushMass() {
    return this.game.tuning.baseMass;
  }

  _syncScale() {
    this.core.scale.setScalar(this.radius);
  }

  /** Sink stuck meshes into the core; convert their mass into radius. */
  _updateMelt(dt) {
    const { meltDuration } = this.game.tuning;
    const duration = Math.max(0.35, meltDuration);

    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      const rate = (1 / duration) * (1.15 / (0.85 + s.mass * 0.25));
      const prev = s.melt;
      s.melt = Math.min(1, s.melt + rate * dt);
      const gained = s.melt - prev;

      if (gained > 0 && s.growthLeft > 0 && prev < 1) {
        const drain = s.growthLeft * (gained / (1 - prev));
        this.radius += drain;
        s.growthLeft = Math.max(0, s.growthLeft - drain);
      }

      const remain = 1 - s.melt;
      const scaleMul = 0.2 + 0.8 * remain;
      s.mesh.scale.set(
        s.baseScale.x * scaleMul,
        s.baseScale.y * scaleMul,
        s.baseScale.z * scaleMul,
      );
      s.mesh.position.copy(s.dir).multiplyScalar(this.radius * (0.25 + 0.7 * remain));

      if (s.melt >= 1) {
        if (s.growthLeft > 0) {
          this.radius += s.growthLeft;
          s.growthLeft = 0;
        }
        s.mesh.removeFromParent();
        s.mesh.geometry?.dispose?.();
        if (s.mesh.material) {
          if (Array.isArray(s.mesh.material)) s.mesh.material.forEach((m) => m.dispose());
          else s.mesh.material.dispose?.();
        }
        this.stuck.splice(i, 1);
      }
    }

    this._syncScale();
    this.position.y = this.radius;
  }

  /**
   * Marble Madness–style tilt force, with lumpy-roll scrape from protrusions.
   * @param {number} dt
   * @param {{ x: number, z: number }} wish
   */
  update(dt, wish) {
    this._updateMelt(dt);

    const {
      pushForce,
      rollingFriction,
      airDrag,
      wallBounce,
      scrapeFriction,
      sizeSpeedGain = 0,
    } = this.game.tuning;
    const protrude = this.protrudingMass;

    if (wish.x !== 0 || wish.z !== 0) {
      // Pusher grows with the ball: flat accel + teeny size bonus (not / core mass)
      const startR = this.game.stage.startRadius;
      const sizeBoost = 1 + Math.max(0, this.radius - startR) * sizeSpeedGain;
      const a = (pushForce * sizeBoost) / Math.max(0.2, this.pushMass);
      this.velocity.x += wish.x * a * dt;
      this.velocity.z += wish.z * a * dt;
    }

    // Per-object scrape — gone when that object finishes melting
    const friction = rollingFriction + this.scrapeMass * scrapeFriction;
    const roll = Math.exp(-friction * dt);
    this.velocity.x *= roll;
    this.velocity.z *= roll;

    let spd = Math.hypot(this.velocity.x, this.velocity.z);
    if (spd > 1e-4) {
      const drag = airDrag * spd;
      this.velocity.x -= (this.velocity.x / spd) * drag * dt;
      this.velocity.z -= (this.velocity.z / spd) * drag * dt;
      spd = Math.hypot(this.velocity.x, this.velocity.z);
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y = this.radius;

    const half = this.game.stage.floorSize * 0.5 - this.radius;
    if (this.position.x > half) {
      this.position.x = half;
      this.velocity.x *= -wallBounce;
    } else if (this.position.x < -half) {
      this.position.x = -half;
      this.velocity.x *= -wallBounce;
    }
    if (this.position.z > half) {
      this.position.z = half;
      this.velocity.z *= -wallBounce;
    } else if (this.position.z < -half) {
      this.position.z = -half;
      this.velocity.z *= -wallBounce;
    }

    // Effective rolling radius grows slightly while lumpy (junk pokes the ground)
    const rollRadius = this.radius + protrude * 0.04;
    if (spd > 1e-5) {
      this._axis.set(-this.velocity.z, 0, this.velocity.x).normalize();
      const angle = -(spd * dt) / rollRadius;
      this._quat.setFromAxisAngle(this._axis, angle);
      this.group.quaternion.premultiply(this._quat);
    }

    this.group.position.copy(this.position);
  }

  /**
   * Scoop: stick on the surface. Volume is granted as the object melts inward.
   * @param {THREE.Object3D} mesh
   * @param {object} typeDef
   */
  absorb(mesh, typeDef) {
    this.group.attach(mesh);
    const local = mesh.position;
    if (local.lengthSq() < 1e-6) local.set(0, 1, 0);
    else local.normalize();
    const dir = local.clone();
    local.multiplyScalar(this.radius * 0.95);

    const baseScale = mesh.scale.clone();
    const growthLeft = typeDef.mass * this.game.tuning.growthPerMass;

    this.stuck.push({
      mesh,
      mass: typeDef.mass,
      melt: 0,
      growthLeft,
      baseScale,
      dir,
    });

    this.count += 1;
    this.massCollected += typeDef.mass;
    // Immediate heft from the scoop (inertia), growth comes via melt
  }
}
