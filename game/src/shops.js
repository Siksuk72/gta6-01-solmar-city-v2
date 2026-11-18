// Lena's Garage upgrades, NOS and the safehouse: progression you buy with
// mission money. Engine and tyre levels make the car faster, armour plating
// makes it tougher, and a NOS tank gives a short burst of speed on demand
// (press N while driving). Sleeping at the safehouse heals you and saves.
import { clamp } from './random.js';

export const GARAGE_UPGRADES = {
  engine: {
    name: 'Engine tune',
    levels: [
      { label: 'Engine tune I — +8 top speed', price: 800, topSpeed: 8, accel: 4 },
      { label: 'Engine tune II — +8 top speed', price: 1600, topSpeed: 8, accel: 4 },
      { label: 'Engine tune III — +10 top speed', price: 3000, topSpeed: 10, accel: 6 },
    ],
  },
  tires: {
    name: 'Grip tyres',
    levels: [
      { label: 'Grip tyres I — sharper steering', price: 500, steer: 0.25 },
      { label: 'Grip tyres II — sharper steering', price: 1200, steer: 0.25 },
    ],
  },
  armor: {
    name: 'Armour plating',
    levels: [
      { label: 'Armour plating I — +60 car health', price: 700, health: 60 },
      { label: 'Armour plating II — +80 car health', price: 1500, health: 80 },
    ],
  },
  brakes: {
    name: 'Brake kit',
    levels: [
      { label: 'Brake kit I — stops 25% harder', price: 450, brake: 10 },
      { label: 'Brake kit II — stops 25% harder again', price: 900, brake: 10 },
    ],
  },
};

export const NOS_PRICE = 350;
export const NOS_MAX_CHARGES = 3;
export const NOS_DURATION = 4.5;
export const NOS_TOP_SPEED_BONUS = 22;

export class GarageSystem {
  constructor() {
    this.nosFlash = 0; // HUD flash timer after a NOS burst
  }

  // The upgrade state lives on the car so each stolen car starts stock.
  // A null car (player on foot at the garage) gets a stock view, not a crash.
  upgradesOf(car) {
    if (!car) return { engine: 0, tires: 0, armor: 0, brakes: 0, nos: 0 };
    if (!car.upgrades) car.upgrades = { engine: 0, tires: 0, armor: 0, brakes: 0, nos: 0 };
    // Cars built before the brake kit existed have no brakes level yet.
    if (car.upgrades.brakes === undefined) car.upgrades.brakes = 0;
    if (car.nosCharges === undefined) car.nosCharges = 0;
    if (car.nosTimer === undefined) car.nosTimer = 0;
    if (car.maxHealth === undefined) car.maxHealth = 100;
    return car.upgrades;
  }

  // Effective top speed / accel / steering / braking for a car with its
  // upgrades. `brake` is the brake force the driving code uses instead of
  // the stock value, so a brake kit actually stops the car shorter.
  tunedSpec(car) {
    if (!car) return { topSpeed: 34, accel: 24, steer: 1.9, brake: 40 };
    const base = car.spec;
    const up = this.upgradesOf(car);
    let topSpeed = base.topSpeed;
    let accel = base.accel;
    let steer = 1.9;
    let brake = 40; // stock brake force, matches TUNE.carBrake
    for (let i = 0; i < up.engine; i += 1) {
      topSpeed += GARAGE_UPGRADES.engine.levels[i].topSpeed;
      accel += GARAGE_UPGRADES.engine.levels[i].accel;
    }
    for (let i = 0; i < up.tires; i += 1) steer += GARAGE_UPGRADES.tires.levels[i].steer;
    for (let i = 0; i < (up.brakes || 0); i += 1) brake += GARAGE_UPGRADES.brakes.levels[i].brake;
    if (car.nosTimer > 0) topSpeed += NOS_TOP_SPEED_BONUS;
    return { topSpeed, accel, steer, brake };
  }

  // Shop items the garage offers for the car the player is driving.
  // On foot there is no car to fit parts to, so the shop says so plainly
  // instead of crashing — a bribe is still on the table.
  garageItems(car) {
    if (!car) {
      return [
        { id: 'nocar', label: 'Bring a car to fit upgrades & NOS', price: 0, disabled: true },
        { id: 'bribe', label: 'Bribe the cops (clear wanted)', price: 250 },
      ];
    }
    const items = [];
    const up = this.upgradesOf(car);
    for (const key of ['engine', 'tires', 'armor', 'brakes']) {
      const def = GARAGE_UPGRADES[key];
      const level = up[key] || 0;
      if (level < def.levels.length) {
        const next = def.levels[level];
        items.push({ id: `upgrade:${key}`, label: next.label, price: next.price });
      } else {
        items.push({ id: `upgrade:${key}:max`, label: `${def.name} — MAXED`, price: 0, disabled: true });
      }
    }
    if (car.nosCharges < NOS_MAX_CHARGES) {
      items.push({ id: 'nos', label: `NOS tank refill (${car.nosCharges}/${NOS_MAX_CHARGES})`, price: NOS_PRICE });
    }
    items.push({ id: 'repair', label: 'Repair current car', price: 100 });
    items.push({ id: 'bribe', label: 'Bribe the cops (clear wanted)', price: 250 });
    return items;
  }

  safehouseItems() {
    return [
      { id: 'sleep', label: 'Sleep — heal up & save the game', price: 0 },
      { id: 'repair', label: 'Repair current car', price: 100 },
      { id: 'bribe', label: 'Bribe the cops (clear wanted)', price: 250 },
    ];
  }

  // Apply one bought garage item. Returns a message for the HUD, or null
  // when the item belongs to another system.
  applyPurchase(game, item, car) {
    if (item.id === 'nos') {
      if (!car) return 'You need a car to fit a NOS tank.';
      this.upgradesOf(car);
      car.nosCharges = clamp(car.nosCharges + 1, 0, NOS_MAX_CHARGES);
      return `NOS tank fitted — ${car.nosCharges}/${NOS_MAX_CHARGES} charges. Press N while driving!`;
    }
    if (item.id === 'sleep') {
      game.player.heal(100);
      game.player.armor = 0;
      game.saveGame();
      return 'You slept at the safehouse. Health restored, game saved.';
    }
    if (item.id && item.id.startsWith('upgrade:')) {
      if (!car) return 'You need to be in a car to fit upgrades.';
      const key = item.id.split(':')[1];
      const def = GARAGE_UPGRADES[key];
      if (!def) return null; // unknown upgrade id: not ours
      const up = this.upgradesOf(car);
      if (up[key] >= def.levels.length) return 'Already maxed out.';
      up[key] += 1;
      if (key === 'armor') {
        car.maxHealth = 100 + def.levels.slice(0, up.armor).reduce((s, l) => s + l.health, 0);
        car.health = car.maxHealth;
      }
      return `${def.name} level ${up[key]} fitted.`;
    }
    return null;
  }

  // Fire a NOS burst while driving. Returns true when a charge was spent.
  triggerNos(car, effects, audio) {
    if (!car) return false;
    this.upgradesOf(car);
    if (car.nosCharges <= 0 || car.nosTimer > 0) return false;
    car.nosCharges -= 1;
    car.nosTimer = NOS_DURATION;
    this.nosFlash = 1.2;
    if (effects) effects.burst(car.x, 0.8, car.z, 0x66ccff, 18, 5, 0.5, 1);
    if (audio) audio.nosWhoosh();
    return true;
  }

  update(dt, car) {
    if (this.nosFlash > 0) this.nosFlash -= dt;
    if (car && car.nosTimer > 0) car.nosTimer -= dt;
  }

  nosInfo(car) {
    if (!car) return { charges: 0, max: NOS_MAX_CHARGES, active: false, timer: 0 };
    this.upgradesOf(car);
    return {
      charges: car.nosCharges,
      max: NOS_MAX_CHARGES,
      active: car.nosTimer > 0,
      timer: Math.max(0, car.nosTimer),
    };
  }
}
