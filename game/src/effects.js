// Visual effects: particle bursts, explosions, muzzle flashes, tracers, the
// mission waypoint beacon and floating collectible markers.
const THREE = window.THREE;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.maxParticles = 1000; // headroom for a car explosion plus a NOS burst at once
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.life = new Float32Array(this.maxParticles);
    this.maxLife = new Float32Array(this.maxParticles);
    this.gravity = new Float32Array(this.maxParticles);
    this.alive = 0;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.flashes = [];
    this.tracers = [];
    this.beacon = null;
    this.rings = [];
    this.shake = 0;
  }

  spawnParticle(x, y, z, vx, vy, vz, r, g, b, life, gravity) {
    if (this.alive >= this.maxParticles) return;
    const i = this.alive;
    this.alive += 1;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.velocities[i * 3] = vx;
    this.velocities[i * 3 + 1] = vy;
    this.velocities[i * 3 + 2] = vz;
    this.colors[i * 3] = r;
    this.colors[i * 3 + 1] = g;
    this.colors[i * 3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
  }

  burst(x, y, z, color, count, speed, life, gravity) {
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.1;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawnParticle(x, y, z,
        Math.cos(angle) * s, up * s, Math.sin(angle) * s,
        r, g, b, life * (0.6 + Math.random() * 0.7), gravity);
    }
  }

  explosion(x, y, z) {
    this.burst(x, y + 0.5, z, 0xff8800, 40, 9, 0.9, 6);
    this.burst(x, y + 0.5, z, 0xffdd44, 24, 6, 0.6, 2);
    this.burst(x, y + 1, z, 0x555555, 20, 3, 1.6, -1);
    const flash = new THREE.PointLight(0xffaa33, 60, 30);
    flash.position.set(x, y + 2, z);
    this.scene.add(flash);
    this.flashes.push({ light: flash, life: 0.35, max: 0.35 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.9 }));
    sphere.position.set(x, y + 1, z);
    this.scene.add(sphere);
    this.flashes.push({ mesh: sphere, life: 0.4, max: 0.4, grows: true });
    this.shake = Math.min(1, this.shake + 0.7);
  }

  muzzleFlash(x, y, z) {
    const flash = new THREE.PointLight(0xffcc66, 12, 9);
    flash.position.set(x, y, z);
    this.scene.add(flash);
    this.flashes.push({ light: flash, life: 0.06, max: 0.06 });
    this.burst(x, y, z, 0xffcc44, 4, 3, 0.15, 0);
  }

  tracer(from, to) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08, max: 0.08 });
  }

  smoke(x, y, z) {
    this.burst(x, y, z, 0x444444, 2, 0.8, 1.4, -0.6);
  }

  // Bright metal sparks for a car scraping a wall or another car: short,
  // fast, and gone before they can pile up.
  sparks(x, y, z) {
    this.burst(x, y, z, 0xffe9a8, 7, 4.5, 0.35, 9);
    this.burst(x, y, z, 0xffaa33, 4, 3, 0.25, 9);
  }

  blood(x, y, z) {
    this.burst(x, y, z, 0xaa1111, 10, 3, 0.5, 8);
  }

  // A tall glowing pillar + ground ring marking the current objective.
  setBeacon(x, z, color) {
    this.clearBeacon();
    const group = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: color || 0xffd800, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 30;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: color || 0xffd800, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(pillar, ring);
    group.position.set(x, 0, z);
    this.scene.add(group);
    this.beacon = { group, pillar, ring, phase: 0 };
  }

  clearBeacon() {
    if (this.beacon) {
      this.scene.remove(this.beacon.group);
      this.beacon = null;
    }
  }

  update(dt, time) {
    // Particles.
    let i = 0;
    while (i < this.alive) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = this.alive - 1;
        for (let c = 0; c < 3; c += 1) {
          this.positions[i * 3 + c] = this.positions[last * 3 + c];
          this.velocities[i * 3 + c] = this.velocities[last * 3 + c];
          this.colors[i * 3 + c] = this.colors[last * 3 + c];
        }
        this.life[i] = this.life[last];
        this.maxLife[i] = this.maxLife[last];
        this.gravity[i] = this.gravity[last];
        this.alive -= 1;
      } else {
        this.velocities[i * 3 + 1] -= this.gravity[i] * dt;
        this.positions[i * 3] += this.velocities[i * 3] * dt;
        this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
        this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
        if (this.positions[i * 3 + 1] < 0.05) this.positions[i * 3 + 1] = 0.05;
        i += 1;
      }
    }
    this.points.geometry.setDrawRange(0, this.alive);
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // Flashes.
    for (let f = this.flashes.length - 1; f >= 0; f -= 1) {
      const item = this.flashes[f];
      item.life -= dt;
      if (item.life <= 0) {
        if (item.light) this.scene.remove(item.light);
        if (item.mesh) this.scene.remove(item.mesh);
        this.flashes.splice(f, 1);
      } else {
        const ratio = item.life / item.max;
        if (item.light) item.light.intensity *= ratio;
        if (item.mesh) {
          item.mesh.scale.setScalar(1 + (1 - ratio) * 6);
          item.mesh.material.opacity = ratio * 0.9;
        }
      }
    }
    // Tracers.
    for (let t = this.tracers.length - 1; t >= 0; t -= 1) {
      const tracer = this.tracers[t];
      tracer.life -= dt;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.line);
        this.tracers.splice(t, 1);
      } else {
        tracer.line.material.opacity = tracer.life / tracer.max;
      }
    }
    // Beacon pulse.
    if (this.beacon) {
      this.beacon.phase += dt * 3;
      const pulse = 0.6 + Math.sin(this.beacon.phase) * 0.3;
      this.beacon.ring.material.opacity = pulse;
      const scale = 1 + Math.sin(this.beacon.phase) * 0.08;
      this.beacon.ring.scale.setScalar(scale);
      this.beacon.pillar.material.opacity = 0.16 + Math.sin(this.beacon.phase) * 0.06;
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }

  shakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const s = this.shake * 0.35;
    return { x: (Math.random() - 0.5) * s, y: (Math.random() - 0.5) * s };
  }
}
