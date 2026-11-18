// Pedestrians: ordinary Solmar residents strolling the sidewalks, who flee
// when gunfire or explosions go off near them.
import { pick, range, distance2D } from './random.js';
import { makePersonMesh, PERSON_PALETTES } from './models.js';

export class PedestrianManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i += 1) this.spawnOne();
  }

  spawnOne(near) {
    const spots = this.city.pedSpawns;
    let spot = spots[Math.floor(Math.random() * spots.length)];
    if (near) {
      for (let tries = 0; tries < 10; tries += 1) {
        const candidate = spots[Math.floor(Math.random() * spots.length)];
        if (distance2D(candidate.x, candidate.z, near.x, near.z) < 120) { spot = candidate; break; }
      }
    }
    const palette = pick(Math.random, PERSON_PALETTES);
    const mesh = makePersonMesh(palette);
    mesh.position.set(spot.x, 0, spot.z);
    this.scene.add(mesh);
    const ped = {
      mesh,
      x: spot.x,
      z: spot.z,
      heading: Math.random() * Math.PI * 2,
      target: null,
      // Strollers walk a touch brisker than before (1.7–2.8 instead of
      // 1.6–2.8): the old low end dawdled mid-crosswalk and blocked traffic.
      speed: 1.7 + Math.random() * 1.1,
      state: 'walk',
      fleeFrom: null,
      walkPhase: Math.random() * 6,
      idleTimer: 0,
      scared: 0,
    };
    mesh.userData.pedRef = ped;
    this.peds.push(ped);
    return ped;
  }

  nearestPed(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of this.peds) {
      const d = distance2D(x, z, ped.x, ped.z);
      if (d < bestDist) { bestDist = d; best = ped; }
    }
    return best;
  }

  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (distance2D(ped.x, ped.z, x, z) < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x, z };
        ped.scared = 6;
      }
    }
  }

  update(dt, playerPos) {
    // Gentle separation so pedestrians do not stack inside each other on
    // a crowded sidewalk: push apart any pair closer than a metre.
    for (let a = 0; a < this.peds.length; a += 1) {
      const pa = this.peds[a];
      for (let b = a + 1; b < this.peds.length; b += 1) {
        const pb = this.peds[b];
        const dx = pb.x - pa.x;
        const dz = pb.z - pa.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 1 && d > 0.001) {
          const push = (1 - d) / 2 / d;
          pa.x -= dx * push;
          pa.z -= dz * push;
          pb.x += dx * push;
          pb.z += dz * push;
        }
      }
    }
    for (const ped of this.peds) {
      if (ped.state === 'flee') {
        ped.scared -= dt;
        const dx = ped.x - ped.fleeFrom.x;
        const dz = ped.z - ped.fleeFrom.z;
        const len = Math.sqrt(dx * dx + dz * dz) || 1;
        const speed = 5.5;
        ped.x += (dx / len) * speed * dt;
        ped.z += (dz / len) * speed * dt;
        ped.heading = Math.atan2(dx / len, dz / len);
        ped.walkPhase += dt * speed * 1.8;
        if (ped.scared <= 0) ped.state = 'walk';
      } else if (ped.state === 'idle') {
        ped.idleTimer -= dt;
        if (ped.idleTimer <= 0) {
          ped.state = 'walk';
          ped.target = null;
        }
      } else {
        if (!ped.target) {
          const spot = this.city.pedSpawns[Math.floor(Math.random() * this.city.pedSpawns.length)];
          ped.target = spot;
          if (Math.random() < 0.12) {
            ped.state = 'idle';
            ped.idleTimer = 2 + Math.random() * 4;
          }
        }
        if (ped.target) {
          const dx = ped.target.x - ped.x;
          const dz = ped.target.z - ped.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 2) {
            ped.target = null;
          } else {
            const speed = ped.speed;
            ped.x += (dx / dist) * speed * dt;
            ped.z += (dz / dist) * speed * dt;
            ped.heading = Math.atan2(dx / dist, dz / dist);
            ped.walkPhase += dt * speed * 1.6;
          }
        }
      }
      // Recycle far-away pedestrians near the player.
      if (playerPos && distance2D(ped.x, ped.z, playerPos.x, playerPos.z) > 240) {
        const spot = this.city.pedSpawns[Math.floor(Math.random() * this.city.pedSpawns.length)];
        ped.x = spot.x;
        ped.z = spot.z;
        ped.target = null;
        ped.state = 'walk';
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = ped.state === 'flee' ? Math.sin(ped.walkPhase) * 0.7 : Math.sin(ped.walkPhase) * 0.5;
      const ud = ped.mesh.userData;
      ud.legL.rotation.x = swing;
      ud.legR.rotation.x = -swing;
      ud.armL.rotation.x = -swing * 0.8;
      ud.armR.rotation.x = swing * 0.8;
    }
  }
}
