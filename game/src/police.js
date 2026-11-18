// The wanted system: stars rise when the player commits crimes, police cars
// chase and ram, foot cops chase and try to bust the player on foot.
import { TUNE } from './config.js';
import { clamp, distance2D } from './random.js';
import { Car } from './vehicles.js';
import { makePersonMesh, COP_PALETTE } from './models.js';

const THREE = window.THREE;

export class WantedSystem {
  constructor(audio) {
    this.audio = audio;
    this.level = 0;
    this.heat = 0;
    this.quietTimer = 0;
    this.onChange = null;
  }

  setLevel(level, silent) {
    const clamped = clamp(Math.round(level), 0, 5);
    if (clamped !== this.level) {
      this.level = clamped;
      this.heat = clamped * 20;
      this.quietTimer = 0;
      if (this.onChange) this.onChange(this.level, silent);
    }
  }

  addCrime(amount) {
    this.heat += amount;
    this.quietTimer = 0;
    const newLevel = clamp(Math.ceil(this.heat / 20), 0, 5);
    if (newLevel > this.level) this.setLevel(newLevel);
  }

  update(dt, committingCrime) {
    if (committingCrime) {
      this.quietTimer = 0;
    } else {
      this.quietTimer += dt;
      if (this.quietTimer > TUNE.wantedDecaySeconds && this.level > 0) {
        this.heat -= dt * 6;
        if (this.heat <= (this.level - 1) * 20) this.setLevel(this.level - 1);
        if (this.heat <= 0) this.setLevel(0);
      }
    }
  }
}

export class PoliceManager {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.cars = [];
    this.cops = [];
    this.bustedTimer = 0;
    this.spawnTimer = 0;
  }

  // The police-response board: every chasing unit with its distance and
  // what it is doing right now — PURSUIT, RAMMING, ROADBLOCK or SPOTLIGHT.
  // `extra` lets the world add foot cops that live in the combat system.
  units(playerPos, heli, extra) {
    const list = [];
    this.cars.forEach((car, i) => {
      list.push({
        name: `UNIT ${i + 1}`,
        kind: 'car',
        dist: Math.round(distance2D(car.x, car.z, playerPos.x, playerPos.z)),
        status: car.unitStatus || 'PURSUIT',
      });
    });
    this.cops.forEach((cop, i) => {
      list.push({
        name: `COP ${i + 1}`,
        kind: 'cop',
        dist: Math.round(distance2D(cop.x, cop.z, playerPos.x, playerPos.z)),
        status: 'PURSUIT',
      });
    });
    for (const unit of extra || []) {
      list.push({
        name: unit.name || 'COP',
        kind: 'cop',
        dist: Math.round(distance2D(unit.x, unit.z, playerPos.x, playerPos.z)),
        status: unit.status || 'PURSUIT',
      });
    }
    if (heli) {
      const air = heli.unitInfo(playerPos);
      if (air) list.push(air);
    }
    return list;
  }

  desiredCarCount(wanted) {
    return wanted === 0 ? 0 : Math.min(wanted, 4);
  }

  desiredCopCount(wanted, playerInCar) {
    if (wanted === 0 || playerInCar) return 0;
    return Math.min(wanted * 2, 6);
  }

  update(dt, wanted, playerPos, playerCar, colliders, allCars, onBusted) {
    // --- police cars ---
    const wantCars = this.desiredCarCount(wanted);
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      const angle = Math.random() * Math.PI * 2;
      // Units spawn a touch closer than the old 70–100 m: the chase used
      // to take a few seconds to even reach the player after the stars rose.
      const dist = 65 + Math.random() * 25;
      let x = clamp(playerPos.x + Math.cos(angle) * dist, -280, 280);
      let z = clamp(playerPos.z + Math.sin(angle) * dist, -280, 280);
      // Snap to the nearest road so the car does not spawn inside a building.
      x = this.city.roadAt(x);
      const car = new Car(this.scene, 'police', undefined, x, z, Math.atan2(playerPos.x - x, playerPos.z - z));
      car.isPolice = true;
      car.cruiseSpeed = 30;
      this.cars.push(car);
      allCars.push(car);
    }
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      if (wanted === 0) {
        // Stand down: drive away and despawn.
        car.remove();
        const index = allCars.indexOf(car);
        if (index !== -1) allCars.splice(index, 1);
        this.cars.splice(i, 1);
        continue;
      }
      // A staged chase car (screenshot cover) drives its own line instead
      // of steering at the player: the pursuit AI would turn it around and
      // leave it behind the camera, out of the frame.
      if (!car.staged) {
        // Chase: steer toward the player, faster than traffic.
        const dx = playerPos.x - car.x;
        const dz = playerPos.z - car.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const desiredHeading = Math.atan2(dx, dz);
        let diff = desiredHeading - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.steer = clamp(diff * 2, -1, 1);
        // A staged chase car can carry its own top speed (cover staging
        // gives the pursuit a faster motor so it stays on the player's tail).
        // At five stars the whole force is on you: every unit runs hotter.
        const chaseTop = (car.chaseTopSpeed || 44) + (wanted >= 5 ? 4 : 0);
        const targetSpeed = dist > 60 ? chaseTop : chaseTop * 0.92;
        car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
        car.heading += car.steer * clamp(Math.abs(car.speed) / 12, 0.3, 1) * dt * 2.2;
      }
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const fwd = car.forward();
      car.x += fwd.x * car.speed * dt;
      car.z += fwd.z * car.speed * dt;
      car.x = clamp(car.x, -300, 300);
      car.z = clamp(car.z, -300, 300);
      const before = { x: car.x, z: car.z };
      const out = this.resolveCar(car, colliders);
      car.x = out.x;
      car.z = out.z;
      if ((before.x !== car.x || before.z !== car.z) && Math.abs(car.speed) > 8) car.speed *= 0.6;
      // Ram the player's car.
      if (playerCar && !playerCar.dead) {
        const d = distance2D(car.x, car.z, playerCar.x, playerCar.z);
        if (d < car.radius + playerCar.radius) {
          const push = (car.radius + playerCar.radius - d) / 2;
          const nx = (playerCar.x - car.x) / (d || 1);
          const nz = (playerCar.z - car.z) / (d || 1);
          playerCar.x += nx * push;
          playerCar.z += nz * push;
          playerCar.damage(3);
          car.speed *= 0.7;
        }
      }
      // What this unit is doing, for the police-response board: a stopped
      // car sitting in the player's path is a ROADBLOCK, a car right on the
      // player's bumper is RAMMING, everything else is in PURSUIT.
      if (Math.abs(car.speed) < 2 && dist < 45) car.unitStatus = 'ROADBLOCK';
      else if (playerCar && dist < 9) car.unitStatus = 'RAMMING';
      else car.unitStatus = 'PURSUIT';
      // Flash the light bar.
      if (car.mesh.userData.lightBar) {
        const phase = Math.floor(performance.now() / 260) % 2 === 0;
        car.mesh.userData.lightBar.userData.red.material.emissive.setHex(phase ? 0xff0000 : 0x220000);
        car.mesh.userData.lightBar.userData.blue.material.emissive.setHex(phase ? 0x000022 : 0x0000ff);
      }
      car.syncMesh(dt);
      // Despawn if hopelessly far.
      if (dist > 320) {
        car.remove();
        const index = allCars.indexOf(car);
        if (index !== -1) allCars.splice(index, 1);
        this.cars.splice(i, 1);
      }
    }
    this.audio.setSiren(wanted > 0 && this.cars.length > 0);

    // --- foot cops ---
    const wantCops = this.desiredCopCount(wanted, !!playerCar);
    if (this.cops.length < wantCops && this.spawnTimer <= 0) {
      this.spawnTimer = 1.0;
      const angle = Math.random() * Math.PI * 2;
      const x = clamp(playerPos.x + Math.cos(angle) * 35, -280, 280);
      const z = clamp(playerPos.z + Math.sin(angle) * 35, -280, 280);
      const mesh = makePersonMesh(COP_PALETTE);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      const cop = { mesh, x, z, heading: 0, walkPhase: 0, shootTimer: 1 + Math.random(), speed: 5.2 };
      this.cops.push(cop);
    }
    let nearestCopDist = Infinity;
    for (let i = this.cops.length - 1; i >= 0; i -= 1) {
      const cop = this.cops[i];
      if (wanted === 0 || playerCar) {
        this.scene.remove(cop.mesh);
        this.cops.splice(i, 1);
        continue;
      }
      const dx = playerPos.x - cop.x;
      const dz = playerPos.z - cop.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      nearestCopDist = Math.min(nearestCopDist, dist);
      if (dist > 90) {
        this.scene.remove(cop.mesh);
        this.cops.splice(i, 1);
        continue;
      }
      if (dist > 2) {
        cop.x += (dx / dist) * cop.speed * dt;
        cop.z += (dz / dist) * cop.speed * dt;
        cop.heading = Math.atan2(dx / dist, dz / dist);
        cop.walkPhase += dt * cop.speed * 1.6;
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      const swing = Math.sin(cop.walkPhase) * 0.5;
      const ud = cop.mesh.userData;
      ud.legL.rotation.x = swing;
      ud.legR.rotation.x = -swing;
      ud.armL.rotation.x = -swing * 0.8;
      ud.armR.rotation.x = swing * 0.8;
      // Shoot at the player when close enough.
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0 && dist < 30 && dist > 3) {
        cop.shootTimer = 1.1 + Math.random();
        this.audio.enemyShot();
        this.effects.muzzleFlash(cop.x, 1.2, cop.z);
        this.effects.tracer({ x: cop.x, y: 1.2, z: cop.z },
          { x: playerPos.x, y: 1.2, z: playerPos.z });
        if (Math.random() < clamp(0.4 - dist / 100, 0.1, 0.35)) {
          if (this.onPlayerShot) this.onPlayerShot(6);
        }
      }
    }
    // Busted: a cop standing next to the player on foot.
    if (!playerCar && wanted > 0 && nearestCopDist < 1.8) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.5 && onBusted) onBusted();
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
  }

  resolveCar(car, colliders) {
    let { x, z } = car;
    const radius = 1.9;
    for (const box of colliders) {
      const closestX = clamp(x, box.minX, box.maxX);
      const closestZ = clamp(z, box.minZ, box.maxZ);
      const dx = x - closestX;
      const dz = z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        x += dx * push;
        z += dz * push;
      }
    }
    return { x, z };
  }

  clearAll(allCars) {
    for (const car of this.cars) {
      car.remove();
      const index = allCars.indexOf(car);
      if (index !== -1) allCars.splice(index, 1);
    }
    this.cars = [];
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cops = [];
    this.bustedTimer = 0;
    this.audio.setSiren(false);
  }
}
