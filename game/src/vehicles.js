// Cars: player driving physics, traffic AI that follows the road grid, car
// damage and explosions, stealing and entering/exiting cars.
import { TUNE } from './config.js';
import { clamp, distance2D, angleLerp } from './random.js';
import { makeCarMesh, CAR_SPECS } from './models.js';

const THREE = window.THREE;

export function resolveCircleVsAABBs(x, z, radius, colliders) {
  for (const box of colliders) {
    const closestX = clamp(x, box.minX, box.maxX);
    const closestZ = clamp(z, box.minZ, box.maxZ);
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (radius - dist) / dist;
        x += dx * push;
        z += dz * push;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushLeft = x - box.minX + radius;
        const pushRight = box.maxX - x + radius;
        const pushUp = z - box.minZ + radius;
        const pushDown = box.maxZ - z + radius;
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) x = box.minX - radius;
        else if (min === pushRight) x = box.maxX + radius;
        else if (min === pushUp) z = box.minZ - radius;
        else z = box.maxZ + radius;
      }
    }
  }
  return { x, z };
}

export class Car {
  constructor(scene, type, colorHex, x, z, heading) {
    this.type = type;
    this.spec = CAR_SPECS[type];
    this.mesh = makeCarMesh(type, colorHex);
    this.mesh.userData.carRef = this;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.scene = scene;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.dead = false;
    this.smoking = false;
    this.parked = false; // A parked car stays put until someone drives it.
    this.occupied = false;
    this.isPlayer = false;
    this.isPolice = type === 'police';
    this.radius = Math.max(this.spec.length, this.spec.width) * 0.42;
    // Traffic AI state.
    this.target = null;
    this.targetNode = null;
    this.cruiseSpeed = 10 + Math.random() * 4;
    this.stuckTimer = 0;
    // Garage state: upgrades, NOS charges and the car's real max health.
    // The garage system fills these in; a fresh stolen car starts stock.
    this.upgrades = { engine: 0, tires: 0, armor: 0, brakes: 0, nos: 0 };
    this.nosCharges = 0;
    this.nosTimer = 0;
    this.maxHealth = 100;
    this.effectiveSpec = null; // tuned top speed / accel / steering, set each frame
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // The name the vehicle panel shows, per car type.
  displayName() {
    const names = {
      sedan: 'Solmar Sedan', sports: 'Comet GT', taxi: 'Marina Taxi',
      truck: 'Hauler Truck', police: 'Police Cruiser', van: 'Courier Van',
    };
    return names[this.type] || 'Car';
  }

  // Arcade driving for the player's car. `effectiveSpec` carries the garage
  // upgrades (engine, tyres, NOS) when set; otherwise the stock spec.
  updatePlayer(dt, input, colliders, otherCars, onScrape) {
    const spec = this.effectiveSpec || this.spec;
    if (this.nosTimer > 0) this.nosTimer -= dt;
    const axes = input.moveAxes();
    const handbrake = input.isDown('Space');
    const accel = axes.forward > 0 ? spec.accel : 0;
    const braking = axes.forward < 0;
    if (accel) this.speed += accel * dt;
    if (braking) {
      // Brake force comes from the tuned spec when the garage fitted a
      // brake kit, so the upgrade actually stops the car shorter.
      const brakeForce = spec.brake || TUNE.carBrake;
      if (this.speed > 0.5) this.speed -= brakeForce * dt;
      else this.speed -= spec.accel * 0.55 * dt;
    }
    if (handbrake) this.speed -= Math.sign(this.speed) * 34 * dt; // the handbrake bites harder than the old 30: a proper slide needs a real bite
    // Drag and rolling resistance.
    this.speed -= this.speed * 0.55 * dt;
    if (!accel && !braking) this.speed -= Math.sign(this.speed) * 4 * dt;
    if (Math.abs(this.speed) < 0.15 && !accel) this.speed = 0;
    this.speed = clamp(this.speed, -spec.topSpeed * 0.32, spec.topSpeed);
    const steerRate = spec.steer || TUNE.carSteer;
    const steerTarget = -axes.strafe * steerRate * clamp(Math.abs(this.speed) / 12, 0.25, 1);
    this.steer = angleLerp(this.steer, steerTarget, Math.min(1, dt * 8));
    const grip = handbrake ? 1.9 : 1;
    this.heading += this.steer * (this.speed / spec.topSpeed) * dt * 2.4 * grip * (this.speed >= 0 ? 1 : -1);
    const fwd = this.forward();
    const prevX = this.x;
    const prevZ = this.z;
    this.x += fwd.x * this.speed * dt;
    this.z += fwd.z * this.speed * dt;
    // World bounds.
    const bound = 300;
    this.x = clamp(this.x, -bound, bound);
    this.z = clamp(this.z, -bound, bound);
    const before = { x: this.x, z: this.z };
    const resolved = resolveCircleVsAABBs(this.x, this.z, 1.9, colliders);
    this.x = resolved.x;
    this.z = resolved.z;
    if ((before.x !== this.x || before.z !== this.z) && Math.abs(this.speed) > 6) {
      this.speed *= 0.55;
      this.damage(4);
      if (onScrape) onScrape();
    }
    // Car-to-car bumps.
    for (const other of otherCars) {
      if (other === this || other.dead) continue;
      const d = distance2D(this.x, this.z, other.x, other.z);
      const minD = this.radius + other.radius;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / 2;
        const nx = (this.x - other.x) / d;
        const nz = (this.z - other.z) / d;
        this.x += nx * push;
        this.z += nz * push;
        other.x -= nx * push;
        other.z -= nz * push;
        const impact = Math.abs(this.speed - other.speed);
        if (impact > 5) {
          this.damage(impact * 0.4);
          other.damage(impact * 0.4);
          if (onScrape) onScrape();
        }
        this.speed *= 0.92;
        other.speed *= 0.92;
      }
    }
    this.syncMesh(dt);
    return { moved: Math.abs(this.x - prevX) + Math.abs(this.z - prevZ) };
  }

  // Traffic AI: drive along the road grid toward the next intersection.
  updateTraffic(dt, city, otherCars) {
    if (this.dead) return;
    if (!this.targetNode) {
      this.targetNode = this.pickNextNode(city);
      if (!this.targetNode) return;
    }
    const tx = this.targetNode.x;
    const tz = this.targetNode.z;
    const dx = tx - this.x;
    const dz = tz - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 4) {
      this.targetNode = this.pickNextNode(city);
      return;
    }
    const desiredHeading = Math.atan2(dx, dz);
    let headingDiff = desiredHeading - this.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    const steer = clamp(headingDiff * 1.6, -1, 1);
    // Slow for a car ahead.
    let targetSpeed = this.cruiseSpeed;
    for (const other of otherCars) {
      if (other === this || other.dead) continue;
      const ox = other.x - this.x;
      const oz = other.z - this.z;
      const ahead = ox * Math.sin(this.heading) + oz * Math.cos(this.heading);
      const side = Math.abs(ox * Math.cos(this.heading) - oz * Math.sin(this.heading));
      if (ahead > 0 && ahead < 9 && side < 2.5) { targetSpeed = Math.min(targetSpeed, 3); break; }
    }
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.5);
    this.heading += steer * clamp(Math.abs(this.speed) / 10, 0.3, 1) * dt * 1.4;
    const fwd = this.forward();
    this.x += fwd.x * this.speed * dt;
    this.z += fwd.z * this.speed * dt;
    // Gentle collision with other traffic.
    for (const other of otherCars) {
      if (other === this || other.dead) continue;
      const d = distance2D(this.x, this.z, other.x, other.z);
      const minD = this.radius + other.radius;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / 2;
        const nx = (this.x - other.x) / d;
        const nz = (this.z - other.z) / d;
        this.x += nx * push;
        this.z += nz * push;
        other.x -= nx * push;
        other.z -= nz * push;
      }
    }
    const resolved = resolveCircleVsAABBs(this.x, this.z, 1.9, city.colliders);
    this.x = resolved.x;
    this.z = resolved.z;
    this.syncMesh(dt);
  }

  pickNextNode(city) {
    // Find the nearest intersection, then pick a random neighbouring one.
    let best = null;
    let bestDist = Infinity;
    for (const node of city.intersections) {
      const d = distance2D(this.x, this.z, node.x, node.z);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    if (!best) return null;
    // If we are mid-block, head to the nearest intersection first.
    if (bestDist > 6) return best;
    const neighbours = [];
    for (const node of city.intersections) {
      const sameRow = node.z === best.z && Math.abs(node.x - best.x) === 58;
      const sameCol = node.x === best.x && Math.abs(node.z - best.z) === 58;
      if (sameRow || sameCol) neighbours.push(node);
    }
    if (neighbours.length === 0) return best;
    return neighbours[Math.floor(Math.random() * neighbours.length)];
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= this.maxHealth * 0.4 && !this.smoking) this.smoking = true;
    if (this.health <= 0) {
      this.dead = true;
      this.health = 0;
    }
  }

  syncMesh(dt) {
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
    this.mesh.rotation.y = this.heading;
    // Wheel spin and steering visuals.
    const wheels = this.mesh.userData.wheels;
    const spin = (this.speed * dt) / this.mesh.userData.wheelR;
    for (let i = 0; i < wheels.length; i += 1) {
      wheels[i].rotation.x += spin;
      if (i < 2) wheels[i].rotation.y = this.steer * 0.4;
    }
    // Body lean and bounce.
    const lean = clamp(-this.steer * this.speed * 0.004, -0.06, 0.06);
    this.mesh.rotation.z = lean;
    this.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.02)) * 0.01 * Math.min(1, Math.abs(this.speed) / 20);
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

export class TrafficManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.types = ['sedan', 'sedan', 'sedan', 'van', 'truck', 'sports'];
  }

  spawnInitial(count, playerPos) {
    for (let i = 0; i < count; i += 1) this.spawnOne(playerPos, true);
  }

  spawnOne(playerPos, anywhere) {
    const spots = this.city.carSpawns;
    let spot = spots[Math.floor(Math.random() * spots.length)];
    if (playerPos && !anywhere) {
      // Spawn within 120 units of the player, at least 40 away.
      for (let tries = 0; tries < 12; tries += 1) {
        const candidate = spots[Math.floor(Math.random() * spots.length)];
        const d = distance2D(candidate.x, candidate.z, playerPos.x, playerPos.z);
        if (d > 40 && d < 140) { spot = candidate; break; }
      }
    }
    const type = this.types[Math.floor(Math.random() * this.types.length)];
    const car = new Car(this.scene, type, undefined, spot.x, spot.z, spot.heading);
    this.cars.push(car);
    return car;
  }

  spawnParked(type, x, z, heading, colorHex) {
    const car = new Car(this.scene, type, colorHex, x, z, heading);
    car.speed = 0;
    car.parked = true;
    this.cars.push(car);
    return car;
  }

  update(dt, playerPos, playerCar) {
    for (const car of this.cars) {
      if (car === playerCar || car.isPolice || car.parked) continue;
      car.updateTraffic(dt, this.city, this.cars);
    }
    // Recycle cars that drifted far from the player.
    if (playerPos) {
      for (const car of this.cars) {
        if (car === playerCar || car.isPolice || car.parked) continue;
        if (distance2D(car.x, car.z, playerPos.x, playerPos.z) > 260) {
          const spot = this.city.carSpawns[Math.floor(Math.random() * this.city.carSpawns.length)];
          car.x = spot.x;
          car.z = spot.z;
          car.heading = spot.heading;
          car.speed = 0;
          car.targetNode = null;
        }
      }
    }
  }

  nearestCar(x, z, maxDist, exclude) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.cars) {
      if (car === exclude || car.dead) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  allCars() {
    return this.cars;
  }
}
