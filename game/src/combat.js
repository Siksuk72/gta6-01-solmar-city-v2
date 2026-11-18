// Combat: the player's shooting and melee, enemy cops and guards who shoot
// back, pickups (cash, health, ammo) and car explosions. Weapons run from
// bare fists up to a long-range rifle — each one defined in config.js.
import { WEAPONS } from './config.js';
import { distance2D, clamp } from './random.js';
import { makePersonMesh, COP_PALETTE, GUARD_PALETTE } from './models.js';

const THREE = window.THREE;

export class CombatSystem {
  constructor(scene, effects, audio) {
    this.scene = scene;
    this.effects = effects;
    this.audio = audio;
    this.enemies = [];
    this.pickups = [];
    this.raycaster = new THREE.Raycaster();
    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.enemyId = 0;
  }

  spawnEnemy(type, x, z) {
    const palette = type === 'cop' ? COP_PALETTE : GUARD_PALETTE;
    const mesh = makePersonMesh(palette);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    // A gun in the right hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.36, 1.05, 0.25);
    mesh.add(gun);
    const enemy = {
      id: this.enemyId += 1,
      type,
      mesh,
      x,
      z,
      heading: 0,
      health: type === 'guard' ? 100 : 80,
      alive: true,
      shootTimer: 1 + Math.random(),
      walkPhase: Math.random() * 6,
      speed: type === 'guard' ? 4.2 : 4.8,
    };
    mesh.userData.enemyRef = enemy;
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.mesh);
    this.enemies = [];
  }

  // A bare-knuckle swing: whatever is right in front of the player, inside
  // the weapon's short reach, takes the hit. No ammo, no noise — just fists.
  playerMelee(camera, player, cars, peds, onHit) {
    const weapon = WEAPONS[player.weapon];
    if (this.fireCooldown > 0) return false;
    this.fireCooldown = weapon.fireRate;
    this.audio.blip(220, 0.08, 'square', 0.1);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const px = player.x;
    const pz = player.z;
    const inReach = (tx, tz) => {
      const dx = tx - px;
      const dz = tz - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > weapon.range) return false;
      const dot = (dx * forward.x + dz * forward.z) / (dist || 1);
      return dot > 0.45;
    };
    let best = null;
    let bestDist = Infinity;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const d = distance2D(px, pz, enemy.x, enemy.z);
      if (d < bestDist && inReach(enemy.x, enemy.z)) { best = { kind: 'enemy', target: enemy }; bestDist = d; }
    }
    for (const ped of peds) {
      const d = distance2D(px, pz, ped.x, ped.z);
      if (d < bestDist && inReach(ped.x, ped.z)) { best = { kind: 'ped', target: ped }; bestDist = d; }
    }
    for (const car of cars) {
      if (car.dead) continue;
      const d = distance2D(px, pz, car.x, car.z);
      if (d < bestDist && inReach(car.x, car.z)) { best = { kind: 'car', target: car }; bestDist = d; }
    }
    if (!best) return true;
    const { kind, target } = best;
    const hx = target.x;
    const hz = target.z;
    if (kind === 'enemy') {
      target.health -= weapon.damage;
      this.effects.blood(hx, 1.2, hz);
      if (target.health <= 0) {
        target.alive = false;
        target.mesh.rotation.x = -Math.PI / 2;
        target.mesh.position.y = 0.25;
        this.spawnPickup('cash', target.x, target.z, 120);
        if (onHit) onHit('enemy', target, weapon.damage);
      } else if (onHit) onHit('enemyHit', target, weapon.damage);
    } else if (kind === 'ped') {
      this.effects.blood(hx, 1.2, hz);
      if (onHit) onHit('ped', target, weapon.damage);
    } else if (kind === 'car') {
      target.damage(weapon.damage);
      this.effects.burst(hx, 1, hz, 0xffcc44, 6, 3, 0.3, 2);
      if (target.dead && onHit) onHit('carDestroyed', target, weapon.damage);
      else if (onHit) onHit('car', target, weapon.damage);
    }
    return true;
  }

  // One player shot from the camera centre. `onHit` is called with
  // ('enemy'|'ped'|'car'|'world', target, damage) so the world can raise
  // the wanted level and count mission kills.
  playerFire(camera, player, cars, peds, solidMeshes, onHit) {
    const weapon = WEAPONS[player.weapon];
    if (weapon.melee) return this.playerMelee(camera, player, cars, peds, onHit);
    if (this.fireCooldown > 0 || this.reloadTimer > 0) return false;
    if (player.magAmmo <= 0) {
      this.startReload(player);
      return false;
    }
    this.fireCooldown = weapon.fireRate;
    player.magAmmo -= 1;
    this.audio.gunshot();
    const pellets = weapon.pellets || 1;
    let fired = false;
    for (let p = 0; p < pellets; p += 1) {
      const spread = weapon.spread;
      const offset = { x: (Math.random() - 0.5) * spread * 2, y: (Math.random() - 0.5) * spread * 2 };
      this.raycaster.setFromCamera(offset, camera);
      this.raycaster.far = weapon.range;
      const targets = [];
      for (const enemy of this.enemies) if (enemy.alive) targets.push(enemy.mesh);
      for (const ped of peds) targets.push(ped.mesh);
      for (const car of cars) if (!car.dead) targets.push(car.mesh);
      targets.push(...solidMeshes);
      const hits = this.raycaster.intersectObjects(targets, true);
      const origin = camera.position.clone();
      let end = origin.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(weapon.range));
      if (hits.length > 0) {
        const hit = hits[0];
        end = hit.point.clone();
        let node = hit.object;
        let enemy = null;
        let ped = null;
        let car = null;
        while (node) {
          if (node.userData.enemyRef) { enemy = node.userData.enemyRef; break; }
          if (node.userData.pedRef) { ped = node.userData.pedRef; break; }
          if (node.userData.carRef) { car = node.userData.carRef; break; }
          node = node.parent;
        }
        if (enemy && enemy.alive) {
          enemy.health -= weapon.damage;
          this.effects.blood(hit.point.x, hit.point.y, hit.point.z);
          if (enemy.health <= 0) {
            enemy.alive = false;
            enemy.mesh.rotation.x = -Math.PI / 2;
            enemy.mesh.position.y = 0.25;
            this.spawnPickup('cash', enemy.x, enemy.z, 120);
            if (onHit) onHit('enemy', enemy, weapon.damage);
          } else if (onHit) onHit('enemyHit', enemy, weapon.damage);
        } else if (ped) {
          this.effects.blood(hit.point.x, hit.point.y, hit.point.z);
          if (onHit) onHit('ped', ped, weapon.damage);
        } else if (car) {
          car.damage(weapon.damage);
          this.effects.burst(hit.point.x, hit.point.y, hit.point.z, 0xffcc44, 6, 3, 0.3, 2);
          if (car.dead && onHit) onHit('carDestroyed', car, weapon.damage);
          else if (onHit) onHit('car', car, weapon.damage);
        } else if (onHit) onHit('world', null, 0);
      }
      this.effects.tracer(origin, end);
      this.effects.muzzleFlash(
        origin.x + this.raycaster.ray.direction.x * 1.2,
        origin.y + this.raycaster.ray.direction.y * 1.2 - 0.3,
        origin.z + this.raycaster.ray.direction.z * 1.2);
      fired = true;
    }
    return fired;
  }

  startReload(player) {
    const weapon = WEAPONS[player.weapon];
    if (weapon.melee || player.magAmmo >= weapon.mag) return;
    this.reloadTimer = 1.1;
    if (this.audio.reloadClick) this.audio.reloadClick();
    else this.audio.blip(300, 0.1, 'square', 0.08);
  }

  update(dt, ctx) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const weapon = WEAPONS[ctx.player.weapon];
        if (!weapon.melee) ctx.player.magAmmo = weapon.mag;
      }
    }
    // Enemies hunt the player.
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = px - enemy.x;
      const dz = pz - enemy.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 120) continue;
      if (dist > 3) {
        const speed = enemy.speed;
        enemy.x += (dx / dist) * speed * dt;
        enemy.z += (dz / dist) * speed * dt;
        enemy.heading = Math.atan2(dx / dist, dz / dist);
        enemy.walkPhase += dt * speed * 1.6;
      }
      enemy.mesh.position.set(enemy.x, 0, enemy.z);
      enemy.mesh.rotation.y = enemy.heading;
      const swing = Math.sin(enemy.walkPhase) * 0.5;
      const ud = enemy.mesh.userData;
      ud.legL.rotation.x = swing;
      ud.legR.rotation.x = -swing;
      ud.armL.rotation.x = -swing * 0.8;
      ud.armR.rotation.x = swing * 0.8;
      // Shoot when in range.
      enemy.shootTimer -= dt;
      const range = ctx.playerCar ? 45 : 38;
      if (enemy.shootTimer <= 0 && dist < range) {
        // Enemies fire a touch slower than before (1.0–1.8 s between shots
        // instead of 0.9–1.8 s): three cops at once used to shred a player
        // on foot before they could reach cover.
        enemy.shootTimer = 1.0 + Math.random() * 0.8;
        const hitChance = clamp(0.55 - dist / 90, 0.12, 0.5);
        this.audio.enemyShot();
        this.effects.muzzleFlash(enemy.x, 1.2, enemy.z);
        this.effects.tracer(
          { x: enemy.x, y: 1.2, z: enemy.z },
          { x: px + (Math.random() - 0.5) * 2, y: 1.2, z: pz + (Math.random() - 0.5) * 2 });
        if (Math.random() < hitChance) {
          if (ctx.playerCar) {
            ctx.playerCar.damage(6);
            if (ctx.onCarDamaged) ctx.onCarDamaged(ctx.playerCar, 6);
          } else {
            const died = ctx.player.damage(8);
            if (ctx.onPlayerDamaged) ctx.onPlayerDamaged(8, died);
          }
        }
      }
    }
    // Pickups bob, spin and get collected.
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      pickup.mesh.rotation.y += dt * 2.5;
      pickup.mesh.position.y = 0.7 + Math.sin(performance.now() * 0.004 + pickup.phase) * 0.15;
      const d = distance2D(pickup.x, pickup.z, ctx.player.x, ctx.player.z);
      if (d < 1.8 && ctx.player.y < 2) {
        this.scene.remove(pickup.mesh);
        this.scene.remove(pickup.light);
        this.pickups.splice(i, 1);
        if (ctx.onPickup) ctx.onPickup(pickup);
      }
    }
  }

  spawnPickup(kind, x, z, amount) {
    // Cash is green, health red, ammo gold — and a found weapon gets its
    // own colour so the player can tell it apart at a glance.
    const colors = { cash: 0x2aff66, health: 0xff5555, ammo: 0xffcc00, shotgun: 0xff8800 };
    const color = colors[kind] || 0xffffff;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
    mesh.position.set(x, 0.7, z);
    this.scene.add(mesh);
    const light = new THREE.PointLight(color, 3, 6);
    light.position.set(x, 1, z);
    this.scene.add(light);
    const pickup = { kind, x, z, amount: amount || 0, mesh, light, phase: Math.random() * 6 };
    this.pickups.push(pickup);
    return pickup;
  }

  clearPickups() {
    for (const pickup of this.pickups) {
      this.scene.remove(pickup.mesh);
      this.scene.remove(pickup.light);
    }
    this.pickups = [];
  }
}
