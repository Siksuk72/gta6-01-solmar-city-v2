// AIR-1, the Solmar police helicopter. It joins the chase once the heat
// hits three stars: circling the player, sweeping a searchlight over the
// streets, and locking the beam on the suspect so ground units can close in.
import { clamp, distance2D } from './random.js';

const THREE = window.THREE;

// The helicopter mesh: dark body with a white belly stripe, a long tail boom,
// skids, a spinning main rotor and tail rotor, and a searchlight cone that
// aims at the ground. userData keeps the moving parts for the update loop.
export function makeHelicopterMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a33 });
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 4.2), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.35, 4.24), whiteMat);
  stripe.position.y = -0.25;
  group.add(stripe);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 1.2), glassMat);
  nose.position.set(0, 0.25, 2.4);
  group.add(nose);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), bodyMat);
  boom.position.set(0, 0.35, -4.2);
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 1.0), bodyMat);
  fin.position.set(0, 0.9, -6.2);
  group.add(fin);
  // Skids.
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4),
      new THREE.MeshLambertMaterial({ color: 0x333333 }));
    skid.position.set(side * 1.0, -1.0, 0.2);
    group.add(skid);
    for (const dz of [-1.2, 1.2]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      strut.position.set(side * 1.0, -0.65, dz);
      group.add(strut);
    }
  }
  // Main rotor: a mast plus two long blades that spin around Y.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), rotorMat);
  mast.position.y = 1.05;
  group.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.45;
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.06, 0.42), rotorMat);
    blade.position.x = side * 3.8;
    rotor.add(blade);
  }
  group.add(rotor);
  // Tail rotor: small blades spinning around X at the end of the boom.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 0.6, -6.2);
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.16), rotorMat);
    blade.position.y = side * 0.75;
    tailRotor.add(blade);
  }
  group.add(tailRotor);
  // Searchlight: a visible cone of light plus a real spotlight aimed down.
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c0, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5.5, 30, 16, 1, true), beamMat);
  beam.geometry.translate(0, -15, 0); // apex at the helicopter, opening downward
  group.add(beam);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaaaa55 }));
  lamp.position.set(0, -0.9, 1.6);
  group.add(lamp);
  const spot = new THREE.SpotLight(0xfff2b0, 60, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.9, 1.6);
  group.add(spot);
  group.userData = { rotor, tailRotor, beam, spot, lamp };
  return group;
}

export class PoliceHelicopter {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.mesh = null;
    this.active = false;
    this.x = 0;
    this.z = 0;
    this.y = 30;
    this.heading = 0;
    this.orbitAngle = 0;
    this.orbitRadius = 24; // a tighter circle than the old 26 m keeps the beam over the streets, not the rooftops
    this.altitude = 30; // cruise height; staging can lower it for a shot
    this.holdOffset = null; // { dx, dz } from the player: hold a fixed spot instead of orbiting (screenshot staging)
    this.rotorAngle = 0;
    this.lockTimer = 0; // seconds the beam has held on the player
    this.status = 'STANDBY';
    this.spotX = 0;
    this.spotZ = 0;
  }

  spawn(x, z, cx, cz) {
    if (this.active) return;
    this.mesh = makeHelicopterMesh();
    this.scene.add(this.mesh);
    this.x = x;
    this.z = z;
    // Orbit angle is measured around the player (cx, cz), not the origin.
    this.orbitAngle = Math.atan2(z - (cz ?? 0), x - (cx ?? 0));
    this.active = true;
    this.status = 'PURSUIT';
    this.lockTimer = 0;
    this.prevHeading = this.heading;
    if (this.audio) {
      this.audio.setRotor(true);
      if (this.audio.sting) this.audio.sting(); // two-note alert: AIR-1 is on you
    }
  }

  clear() {
    if (!this.active) return;
    this.scene.remove(this.mesh);
    this.mesh = null;
    this.active = false;
    this.status = 'STANDBY';
    this.lockTimer = 0;
    if (this.audio) this.audio.setRotor(false);
  }

  // One line for the police-response panel: callsign, distance, status.
  unitInfo(playerPos) {
    if (!this.active) return null;
    return {
      name: 'AIR-1',
      kind: 'heli',
      dist: Math.round(distance2D(this.x, this.z, playerPos.x, playerPos.z)),
      status: this.status,
    };
  }

  update(dt, wanted, playerPos, playerCar, time) {
    if (wanted < 3) {
      if (this.active) this.clear();
      return;
    }
    if (!this.active) {
      const angle = Math.random() * Math.PI * 2;
      this.spawn(playerPos.x + Math.cos(angle) * 40, playerPos.z + Math.sin(angle) * 40,
        playerPos.x, playerPos.z);
    }
    // Circle the player at altitude, a little faster at higher heat — or
    // hold a fixed offset from the player when staging asks for it.
    let targetX;
    let targetZ;
    if (this.holdOffset) {
      targetX = playerPos.x + this.holdOffset.dx;
      targetZ = playerPos.z + this.holdOffset.dz;
    } else {
      this.orbitAngle += dt * (0.35 + wanted * 0.05);
      targetX = playerPos.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      targetZ = playerPos.z + Math.sin(this.orbitAngle) * this.orbitRadius;
    }
    // A held helicopter tracks its offset much faster: the player drives
    // at ~48 u/s, and a slow lerp would leave the heli trailing ~30 m
    // behind its hold point (and out of the top of the frame).
    const trackRate = this.holdOffset ? 6 : 1.6;
    this.x += (targetX - this.x) * Math.min(1, dt * trackRate);
    this.z += (targetZ - this.z) * Math.min(1, dt * trackRate);
    const targetAlt = this.altitude + (playerCar ? 4 : 0);
    this.y += (targetAlt - this.y) * Math.min(1, dt * 0.8);
    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const desired = Math.atan2(dx, dz);
    let diff = desired - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, dt * 2);
    // The searchlight sweeps in a slow circle and snaps onto the player
    // once the beam has held for a while; a locked beam is SPOTLIGHT.
    // The lock builds slowly while the beam sweeps near the player (<15 m)
    // and fast once it is right on them (<6 m) — the sweep starts 14 m
    // out, so the near range is what lets the lock ever engage.
    const sweep = time * 0.7;
    const sweepR = 14;
    const beamX = playerPos.x + Math.cos(sweep) * sweepR * (1 - clamp(this.lockTimer / 2, 0, 0.85));
    const beamZ = playerPos.z + Math.sin(sweep) * sweepR * (1 - clamp(this.lockTimer / 2, 0, 0.85));
    this.spotX = beamX;
    this.spotZ = beamZ;
    const beamDist = distance2D(beamX, beamZ, playerPos.x, playerPos.z);
    if (beamDist < 6) this.lockTimer += dt;
    else if (beamDist < 15) this.lockTimer += dt * 0.35;
    else this.lockTimer = Math.max(0, this.lockTimer - dt * 2);
    this.status = this.lockTimer > 1.2 ? 'SPOTLIGHT' : 'PURSUIT';
    // Animate the mesh.
    this.rotorAngle += dt * 26;
    const ud = this.mesh.userData;
    ud.rotor.rotation.y = this.rotorAngle;
    ud.tailRotor.rotation.x = this.rotorAngle * 3.1;
    this.mesh.position.set(this.x, this.y + Math.sin(time * 1.4) * 0.6, this.z);
    this.mesh.rotation.y = this.heading;
    this.mesh.rotation.z = Math.sin(time * 0.9) * 0.05;
    // Aim the beam cone and the real spotlight at the swept ground point.
    const beamTarget = new THREE.Vector3(beamX, 0, beamZ);
    ud.spot.target.position.copy(beamTarget);
    this.mesh.add(ud.spot.target);
    ud.spot.target.updateMatrixWorld();
    const from = new THREE.Vector3(this.x, this.y - 0.9, this.z);
    const dir = beamTarget.clone().sub(from).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    ud.beam.quaternion.copy(quat);
    ud.beam.material.opacity = this.status === 'SPOTLIGHT' ? 0.22 : 0.13;
    // Bank into the turn: the faster the heading changes, the more lean.
    let headingDiff = this.heading - (this.prevHeading ?? this.heading);
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    this.prevHeading = this.heading;
    this.mesh.rotation.z = Math.sin(time * 0.9) * 0.05 + clamp(headingDiff * 4, -0.18, 0.18);
  }
}
