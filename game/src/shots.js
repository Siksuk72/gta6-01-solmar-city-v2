// Screenshot scenes behind ?shot=cover|chase|mission|city. Each one sets up a
// real, playable game state — a car chase, a shootout, a mission in progress,
// a city vista — and lets the game run forward from there, so the frame is
// what the game itself looks like in play. The cover is a chase already in
// motion: the player's car speeding up the beach avenue with three police
// cars, the AIR-1 helicopter overhead, traffic and pedestrians in frame.
import { WEAPONS } from './config.js';
import { Car } from './vehicles.js';

function stagePoliceCar(game, x, z, heading, speed) {
  const car = new Car(game.scene, 'police', undefined, x, z, heading);
  car.isPolice = true;
  car.cruiseSpeed = 30;
  car.speed = speed || 30;
  car.chaseTopSpeed = 54; // faster than the getaway car, so the chase stays in frame
  // Staged: this car drives its own straight line and never gets steered
  // by the pursuit AI (which would turn it around to chase from behind
  // the camera, out of the frame — the old cover's missing police cars).
  car.staged = true;
  game.police.cars.push(car);
  game.traffic.cars.push(car);
  return car;
}

export function stageShot(game, name) {
  game.audio.ensure();
  game.hud.hideTitle();
  game.state = 'playing';
  // Pin the clock to golden hour for every shot: a staged scene must look
  // the same on a retake even if the game ran for a while before staging.
  game.clockMinutes = 17 * 60 + 30;
  const wanted = game.wanted;
  const missions = game.missions;

  if (name === 'chase') {
    // On foot at a downtown intersection, wanted level 4, foot cops closing
    // in, a police car across the street, and AIR-1 circling overhead.
    game.player.teleport(29, 87);
    game.player.heading = Math.PI * 0.75;
    game.player.weapon = 'rifle';
    game.ownedWeapons.add('rifle');
    game.ownedWeapons.add('smg');
    game.player.magAmmo = WEAPONS.rifle.mag;
    game.player.cash = 2450;
    missions.startMission(3);
    missions.stepIndex = 0;
    missions.startStep();
    wanted.setLevel(4);
    game.combat.spawnEnemy('cop', 38, 100);
    game.combat.spawnEnemy('cop', 18, 72);
    game.combat.spawnEnemy('cop', 44, 78);
    const patrol = game.traffic.spawnParked('police', 22, 116, Math.PI * 0.85);
    patrol.isPolice = true;
    game.police.spawnTimer = 1e9;
    game.helicopter.spawn(50, 60, 29, 87);
    game.helicopter.lockTimer = 2;
    game.dialogue.clear();
    game.dialogue.say('lena', 'Four stars, Jax — and AIR-1 just joined the party. Do not stand still.');
    game.cam.yaw = 0.8;
    game.cam.pitch = 0.34;
    game.cam.targetDistance = 11;
    game.cam.position.set(37, 4.5, 95);
    game.cam.lookTarget.set(29, 1.6, 87);
  } else if (name === 'mission') {
    // Mission 7, Harbor Lights: the player in a sports car on the docks
    // road, Rico waiting ahead by the crates, the beacon over the next
    // crate, wanted 3.
    game.hotelCar.x = 203;
    game.hotelCar.z = -16;
    game.hotelCar.heading = Math.PI;
    game.hotelCar.syncMesh(0);
    game.enterCar(game.hotelCar);
    game.player.cash = 3120;
    game.ownedWeapons.add('smg');
    missions.startMission(6);
    missions.stepIndex = 2;
    missions.startStep();
    wanted.setLevel(3);
    game.combat.spawnEnemy('guard', 216, -42);
    game.combat.spawnEnemy('guard', 190, -52);
    game.combat.spawnEnemy('guard', 216, -16);
    game.helicopter.spawn(230, 10, 190, -16);
    game.dialogue.clear();
    game.dialogue.say('rico', 'Four crates, Jax — grab them before Tavares burns the lot.');
    game.cam.yaw = 0;
    game.cam.pitch = 0.42;
    game.cam.targetDistance = 18;
    game.cam.position.set(203, 8, 2);
    game.cam.lookTarget.set(203, 1.6, -16);
  } else if (name === 'city') {
    // A high vista over downtown at golden hour, HUD and minimap visible,
    // the radio playing and the first job on the board.
    game.player.teleport(-58, 116);
    game.player.cash = 1875;
    game.ownedWeapons.add('smg');
    missions.startMission(0);
    game.vistaMode = true;
    game.cam.setVista();
  } else {
    // Cover: the getaway, mid-chase. The red sports car speeds north up
    // the beach avenue at golden hour — palms and neon on the left, the
    // ocean behind — with three police cars on it and AIR-1 overhead.
    game.hotelCar.x = -261;
    game.hotelCar.z = 110;
    game.hotelCar.heading = Math.PI;
    game.hotelCar.syncMesh(0);
    game.enterCar(game.hotelCar);
    game.hotelCar.speed = 34; // already speeding when the frame opens
    game.player.cash = 4320;
    game.player.weapon = 'smg';
    game.ownedWeapons.add('smg');
    game.player.magAmmo = WEAPONS.smg.mag;
    missions.startMission(2);
    missions.stepIndex = 2;
    missions.startStep();
    wanted.setLevel(4);
    // Hold off the police manager's own spawns; the staged units below
    // are the chase, and they steer themselves once the game runs.
    game.police.spawnTimer = 1e9;
    // The frame opens ~3 s of game time after staging (60 rAF frames at
    // 0.05 s each), and the getaway car accelerates from 34 to its 48 top
    // speed in that time — about 135 m, so the player is near z≈-25 and
    // the camera near z≈-10 when the shutter falls. A staged car must
    // start far enough ahead, and slow enough, to still be ~30 m in front
    // of the camera then: the tail car stays behind (felt, not seen),
    // the two flank cars hold the frame left and right.
    stagePoliceCar(game, -261, 132, Math.PI, 34); // tail, closing in
    stagePoliceCar(game, -252, 50, Math.PI, 30); // right flank, ahead at the frame
    stagePoliceCar(game, -270, 54, Math.PI, 32); // left flank, ahead at the frame
    // A roadblock parked at the beach edge of the avenue ahead, facing the
    // player — visible, but off the driving lane (and clear of the left
    // flank's line) so nothing rams it before the frame is taken.
    const roadblock = game.traffic.spawnParked('police', -276, 40, 0);
    roadblock.isPolice = true;
    game.helicopter.spawn(-288, 66, -261, 110);
    game.helicopter.altitude = 12; // low over the beach avenue, in frame
    game.helicopter.y = 14;
    // Hold ahead-west of the player, in the sky band the camera sees,
    // instead of orbiting out of frame.
    game.helicopter.holdOffset = { dx: -18, dz: -46 };
    game.helicopter.lockTimer = 2; // beam already locked: SPOTLIGHT
    // Traffic and pedestrians in frame so the avenue reads as alive.
    const van = game.traffic.spawnParked('sedan', -252, 58, Math.PI);
    van.parked = false;
    van.cruiseSpeed = 12;
    const taxi = game.traffic.spawnParked('taxi', -268, 140, 0);
    taxi.parked = false;
    taxi.cruiseSpeed = 12;
    // One more car further up the avenue, still ahead when the frame opens.
    const ahead = game.traffic.spawnParked('sedan', -252, -30, Math.PI);
    ahead.parked = false;
    ahead.cruiseSpeed = 14;
    game.peds.spawnOne({ x: -248, z: 92 });
    game.peds.spawnOne({ x: -274, z: 100 });
    game.peds.spawnOne({ x: -248, z: 122 });
    game.peds.spawnOne({ x: -274, z: 70 });
    // Radio on Palm Wave, Eddie on the wire, car driving itself.
    game.radio.nextStation();
    game.dialogue.clear();
    game.dialogue.say('eddie', 'HA! Did you see their faces? You drive like the road owes you money.');
    game.autoDrive = true;
    game.cam.yaw = 0;
    game.cam.pitch = 0.22;
    game.cam.targetDistance = 13;
    game.cam.position.set(-261, 4.6, 124);
    game.cam.lookTarget.set(-261, 1.6, 98);
  }
  // Clear the mission briefing toast so it does not cover the frame.
  game.drainEvents();
  game.hud.showMessage('', 0.01);
}
