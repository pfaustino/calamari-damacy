import * as THREE from 'three';

/**
 * Floor, lighting, and sky backdrop for the tide pool.
 */
export class World {
  /** @param {import('./Game.js').Game} game */
  constructor(game) {
    this.game = game;
  }

  init() {
    const scene = this.game.scene;
    const size = this.game.stage.floorSize;

    scene.background = new THREE.Color(0x7eb8d4);
    scene.fog = new THREE.Fog(0x7eb8d4, size * 0.35, size * 0.85);

    const hemi = new THREE.HemisphereLight(0xb8e0f0, 0x3d6b4f, 0.85);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    const extent = size * 0.55;
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    scene.add(sun);

    const floorGeo = new THREE.PlaneGeometry(size, size, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xd4c4a8,
      roughness: 0.95,
      metalness: 0,
    });
    // Checker-ish sand via vertex colors
    const colors = [];
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const cell = (Math.floor(x / 4) + Math.floor(y / 4)) & 1;
      if (cell) colors.push(0.78, 0.72, 0.58);
      else colors.push(0.86, 0.8, 0.66);
    }
    floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    floorMat.vertexColors = true;

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Soft rim of water-colored walls so the arena reads
    const wallH = 1.2;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x4a9bb8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.4,
    });
    const rim = new THREE.Group();
    const half = size / 2;
    const sides = [
      { w: size, d: 0.4, x: 0, z: -half },
      { w: size, d: 0.4, x: 0, z: half },
      { w: 0.4, d: size, x: -half, z: 0 },
      { w: 0.4, d: size, x: half, z: 0 },
    ];
    for (const s of sides) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, wallH, s.d), wallMat);
      m.position.set(s.x, wallH / 2, s.z);
      rim.add(m);
    }
    scene.add(rim);

    this.floor = floor;
  }
}
