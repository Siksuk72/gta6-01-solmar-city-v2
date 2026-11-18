// Side activities: taxi fares, the beach street race, hidden cash bundles
// and the shops (guns, clinic, garage repairs and bribes).
import { ACTIVITIES, SHOPS } from './config.js';
import { distance2D, shuffle } from './random.js';
import { makePersonMesh, PERSON_PALETTES } from './models.js';

export class ActivityManager {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.collectibles = [];
    this.taxi = { active: false, passenger: null, dest: null, timer: 0, fare: 0 };
    this.race = { active: false, gateIndex: 0, timeLeft: 0, gates: [] };
    this.shopNear = null;
    this.events = [];
  }

  spawnCollectibles(count, taken) {
    const spots = [];
    for (let i = 0; i < count; i += 1) {
      if (taken && taken.includes(i)) continue;
      const road = this.city.intersections[Math.floor(Math.random() * this.city.intersections.length)];
      const spot = {
        id: i,
        x: road.x + (Math.random() < 0.5 ? -10 : 10) + (Math.random() - 0.5) * 4,
        z: road.z + (Math.random() < 0.5 ? -10 : 10) + (Math.random() - 0.5) * 4,
      };
      spots.push(spot);
    }
    return spots;
  }

  buildCollectibleMeshes(spots, combat) {
    for (const spot of spots) {
      combat.spawnPickup('cash', spot.x, spot.z, ACTIVITIES.collectibleValue);
    }
    this.collectibles = spots;
  }

  // --- taxi ---
  startTaxi(playerCar, playerPos) {
    if (this.taxi.active) return false;
    if (!playerCar || playerCar.type !== 'taxi') return false;
    const dest = this.city.intersections[Math.floor(Math.random() * this.city.intersections.length)];
    const fare = ACTIVITIES.taxiFareBase + Math.round(distance2D(playerPos.x, playerPos.z, dest.x, dest.z) * ACTIVITIES.taxiFarePerMetre);
    this.taxi = { active: true, passenger: null, dest, timer: 90, fare };
    this.events.push({ type: 'message', text: `Taxi fare: drive to the marker — $${fare} if you make it in time, $25 tip if you are fast.` });
    this.effects.setBeacon(dest.x, dest.z, 0x2aff66);
    return true;
  }

  updateTaxi(dt, playerCar, playerPos) {
    if (!this.taxi.active) return;
    this.taxi.timer -= dt;
    if (this.taxi.timer <= 0) {
      this.taxi.active = false;
      this.effects.clearBeacon();
      this.events.push({ type: 'message', text: 'Fare expired — the passenger gave up waiting.' });
      return;
    }
    if (playerCar && distance2D(playerCar.x, playerCar.z, this.taxi.dest.x, this.taxi.dest.z) < 10) {
      // A fast drop earns a tip: more than 30 s left on the meter means
      // the passenger was barely kept waiting, so they pay $25 extra.
      const tip = this.taxi.timer > 30 ? 25 : 0;
      const fare = this.taxi.fare + tip;
      this.taxi.active = false;
      this.effects.clearBeacon();
      this.events.push({ type: 'taxiPaid', fare });
      this.audio.cashSound();
    }
  }

  cancelTaxi() {
    if (this.taxi.active) {
      this.taxi.active = false;
      this.effects.clearBeacon();
    }
  }

  // --- street race ---
  startRace() {
    if (this.race.active) return false;
    const gates = [];
    const picks = shuffle(Math.random, [...this.city.intersections]).slice(0, 8);
    for (const node of picks) gates.push([node.x, node.z]);
    this.race = { active: true, gateIndex: 0, timeLeft: 120, gates };
    this.events.push({ type: 'message', text: 'Beach Race: hit all 8 gates in 2 minutes for $800!' });
    this.effects.setBeacon(gates[0][0], gates[0][1], 0xff8800);
    return true;
  }

  updateRace(dt, playerCar, playerPos) {
    if (!this.race.active) return;
    this.race.timeLeft -= dt;
    if (this.race.timeLeft <= 0) {
      this.race.active = false;
      this.effects.clearBeacon();
      this.events.push({ type: 'message', text: 'Race over — out of time.' });
      return;
    }
    const pos = playerCar ? { x: playerCar.x, z: playerCar.z } : playerPos;
    const gate = this.race.gates[this.race.gateIndex];
    if (gate && distance2D(pos.x, pos.z, gate[0], gate[1]) < 12) {
      this.race.gateIndex += 1;
      this.audio.pickup();
      if (this.race.gateIndex >= this.race.gates.length) {
        this.race.active = false;
        this.effects.clearBeacon();
        this.events.push({ type: 'raceWon', reward: ACTIVITIES.raceReward });
        this.audio.missionComplete();
      } else {
        const next = this.race.gates[this.race.gateIndex];
        this.effects.setBeacon(next[0], next[1], 0xff8800);
      }
    }
  }

  cancelRace() {
    if (this.race.active) {
      this.race.active = false;
      this.effects.clearBeacon();
    }
  }

  // --- shops ---
  nearestShop(x, z) {
    for (const shop of SHOPS) {
      if (distance2D(x, z, shop.pos[0], shop.pos[1]) < 7) return shop;
    }
    return null;
  }

  // The car the player is driving when a shop opens — the garage needs it
  // to price and fit upgrades. Always overwritten, even with null: keeping
  // yesterday's car would let the garage fit parts to a car the player
  // already left behind (or one that has since exploded).
  shopItems(shop, car) {
    this.currentCar = car || null;
    if (shop.kind === 'guns') {
      return [
        { id: 'ammo', label: 'Reload pistol (full mag)', price: ACTIVITIES.ammoPrice },
        { id: 'smg', label: 'Buy SMG', price: 400 },
        { id: 'shotgun', label: 'Buy Shotgun', price: 600 },
        { id: 'rifle', label: 'Buy Rifle (long range)', price: ACTIVITIES.riflePrice },
        { id: 'armor', label: 'Body armour (+50)', price: ACTIVITIES.armorPrice },
      ];
    }
    if (shop.kind === 'clinic') {
      return [{ id: 'heal', label: 'Full treatment (restore health)', price: ACTIVITIES.healPrice }];
    }
    if (shop.kind === 'garage') {
      // Upgrades, NOS and repairs come from the garage system.
      if (this.onGarageItems) return this.onGarageItems(this.currentCar);
      return [
        { id: 'repair', label: 'Repair current car', price: ACTIVITIES.repairPrice },
        { id: 'bribe', label: 'Bribe the cops (clear wanted)', price: ACTIVITIES.bribePrice },
      ];
    }
    if (shop.kind === 'safehouse') {
      if (this.onSafehouseItems) return this.onSafehouseItems();
      return [{ id: 'sleep', label: 'Sleep — heal up & save the game', price: 0 }];
    }
    if (shop.kind === 'race') {
      return [{ id: 'race', label: 'Start the Beach Race ($800 prize)', price: 0 }];
    }
    return [];
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
