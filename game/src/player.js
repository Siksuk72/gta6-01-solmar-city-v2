// The player on foot: third-person movement, jumping, walk animation and
// collision with buildings and cars.
import { TUNE } from './config.js';
import { clamp, distance2D } from './random.js';
import { makePersonMesh, PLAYER_PALETTE } from './models.js';
import { resolveCircleVsAABBs } from './vehicles.js';

const THREE = window.THREE;

export class Player {
  constructor(scene, x, z) {
    this.mesh = makePersonMesh(PLAYER_PALETTE);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.heading = 0;
    this.speed = 0;
    this.health = TUNE.playerHealth;
    this.armor = 0;
    this.cash = 200;
    this.weapon = 'pistol';
    this.magAmmo = 12;
    this.moving = false;
    this.walkPhase = 0;
    this.onGround = true;
  }

  update(dt, input, cameraYaw, colliders, cars) {
    const axes = input.moveAxes();
    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const targetSpeed = running ? TUNE.playerRunSpeed : TUNE.playerWalkSpeed;
    // Movement relative to the camera yaw.
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    let mx = 0;
    let mz = 0;
    if (axes.forward !== 0 || axes.strafe !== 0) {
      // Camera forward on the ground plane is (-sin(yaw), -cos(yaw)) for a
      // camera looking along -Z rotated by yaw; use the camera's own basis.
      mx = -sin * axes.forward + cos * axes.strafe;
      mz = -cos * axes.forward - sin * axes.strafe;
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
      this.moving = true;
      const targetHeading = Math.atan2(mx, mz);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Turn a little sharper than the old dt*12: at a full sprint Jax
      // used to swing wide around corners and clip building edges.
      this.heading += diff * Math.min(1, dt * 14);
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    } else {
      this.moving = false;
      this.speed += (0 - this.speed) * Math.min(1, dt * 10);
    }
    const prevX = this.x;
    const prevZ = this.z;
    this.x += mx * this.speed * dt;
    this.z += mz * this.speed * dt;
    // Jump and gravity.
    if (input.wasPressed('Space') && this.onGround) {
      this.vy = TUNE.playerJump;
      this.onGround = false;
    }
    this.vy -= TUNE.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0;
      this.onGround = true;
    }
    // Bounds and building collision.
    const bound = 300;
    this.x = clamp(this.x, -bound, bound);
    this.z = clamp(this.z, -bound, bound);
    const resolved = resolveCircleVsAABBs(this.x, this.z, 0.6, colliders);
    this.x = resolved.x;
    this.z = resolved.z;
    // Push out of cars.
    for (const car of cars) {
      if (car.dead) continue;
      const d = distance2D(this.x, this.z, car.x, car.z);
      const minD = car.radius + 0.6;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / d;
        this.x += (this.x - car.x) * push;
        this.z += (this.z - car.z) * push;
      }
    }
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    // Walk cycle.
    const movingNow = Math.abs(this.x - prevX) + Math.abs(this.z - prevZ) > 0.001;
    if (movingNow) this.walkPhase += dt * this.speed * 1.6;
    const swing = movingNow ? Math.sin(this.walkPhase) * 0.55 : 0;
    const ud = this.mesh.userData;
    ud.legL.rotation.x = swing;
    ud.legR.rotation.x = -swing;
    ud.armL.rotation.x = -swing * 0.8;
    ud.armR.rotation.x = swing * 0.8;
    if (!movingNow) {
      ud.legL.rotation.x *= 0.8;
      ud.legR.rotation.x *= 0.8;
      ud.armL.rotation.x *= 0.8;
      ud.armR.rotation.x *= 0.8;
    }
  }

  damage(amount) {
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.6);
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    this.health -= remaining;
    if (this.health < 0) this.health = 0;
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(TUNE.playerHealth, this.health + amount);
  }

  addArmor(amount) {
    this.armor = Math.min(100, this.armor + amount);
  }

  teleport(x, z) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    // A teleport is a fresh start, not a slide: drop any leftover run
    // speed (exiting a fast car used to keep the player gliding).
    this.speed = 0;
    this.moving = false;
    this.walkPhase = 0;
    this.mesh.position.set(x, 0, z);
  }
}
