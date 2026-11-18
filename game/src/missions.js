// The story: eight missions for Jax Marlowe, from Lena's garage to the top
// of Solmar City. A small step engine drives each mission's objectives,
// markers, spawns and rewards, and the crew talks through every job —
// dialogue lines fire when a job opens and when the payout lands.
import { MISSIONS } from './config.js';
import { distance2D } from './random.js';
import { makePersonMesh } from './models.js';

const NPC_POSITIONS = {
  lena: { x: -87, z: 145, palette: { shirt: 0xc22a2a, pants: 0x222222, skin: 0xe8b88a, hair: 0x1a1a1a } },
  eddie: { x: 87, z: -145, palette: { shirt: 0xe8c84a, pants: 0x333333, skin: 0xc98e6a, hair: 0x000000 } },
  mira: { x: -203, z: 87, palette: { shirt: 0x2a9d8f, pants: 0x223344, skin: 0xe8b88a, hair: 0x3a1a0a } },
  rico: { x: 203, z: -29, palette: { shirt: 0x4a6a8a, pants: 0x2a2a2a, skin: 0x8a5a3a, hair: 0x111111 } },
  nadia: { x: 116, z: -116, palette: { shirt: 0x7a4a9a, pants: 0x1a1a1a, skin: 0xc98e6a, hair: 0x4a2a1a } },
};

export class MissionManager {
  constructor(scene, city, effects, audio) {
    this.scene = scene;
    this.city = city;
    this.effects = effects;
    this.audio = audio;
    this.missionIndex = 0;
    this.stepIndex = 0;
    this.stepState = {};
    this.active = false;
    this.storyComplete = false;
    this.events = [];
    this.marker = null;
    this.npcs = {};
    this.missionCar = null;
    this.convoyCar = null;
    this.raceTimeLeft = 0;
    this.missionTime = 0; // seconds spent on the current job, shown in the HUD
    this.dialogue = null; // wired by the world: a DialogueSystem
    this.onSetWanted = null;
    this.onSpawnMissionCar = null;
    this.onSpawnMissionDrops = null;
    this.onSpawnGuards = null;
    this.onNextDropPosition = null;
    this.onSpawnConvoy = null;
    this.onClearConvoy = null;
    this.createNpcs();
  }

  createNpcs() {
    for (const [name, def] of Object.entries(NPC_POSITIONS)) {
      const mesh = makePersonMesh(def.palette);
      mesh.position.set(def.x, 0, def.z);
      if (name === 'eddie') mesh.scale.setScalar(1.18);
      this.scene.add(mesh);
      this.npcs[name] = { mesh, x: def.x, z: def.z };
    }
  }

  currentMission() {
    return MISSIONS[this.missionIndex] || null;
  }

  currentStep() {
    const mission = this.currentMission();
    if (!mission) return null;
    return mission.steps[this.stepIndex] || null;
  }

  // HUD stage readout: "MISSION 3/8", "STAGE 2/4", and what comes next.
  missionStage() {
    const mission = this.currentMission();
    if (!mission || !this.active) return null;
    const next = mission.steps[this.stepIndex + 1];
    return {
      number: this.missionIndex + 1,
      total: MISSIONS.length,
      stage: this.stepIndex + 1,
      stages: mission.steps.length,
      next: next ? (next.label || '') : 'Finish the job',
      progress: mission.steps.length ? (this.stepIndex + 1) / mission.steps.length : 1,
    };
  }

  startMission(index) {
    this.missionIndex = index;
    this.stepIndex = 0;
    this.stepState = {};
    this.active = true;
    this.missionTime = 0;
    const mission = this.currentMission();
    if (!mission) {
      this.active = false;
      this.storyComplete = true;
      return;
    }
    this.events.push({ type: 'message', text: `New mission: ${mission.name}` });
    this.events.push({ type: 'message', text: mission.briefing });
    if (this.dialogue) this.dialogue.sayMissionLines(mission.id, 'start');
    this.startStep();
  }

  startStep() {
    const step = this.currentStep();
    this.stepState = { collected: 0, killed: 0, gateIndex: 0, holdTime: 0, raceTime: 0, chaseTime: 0 };
    if (!step) {
      this.completeMission();
      return;
    }
    if (step.wanted !== undefined && this.onSetWanted) this.onSetWanted(step.wanted);
    if (step.type === 'collect') this.spawnMissionDrops(step.count);
    if (step.type === 'kill') this.spawnGuards(step.count);
    if (step.type === 'race') this.raceTimeLeft = 135; // five gates across town fit in 2:15 at getaway pace; the old 2:30 let a slow cruise pass
    if (step.type === 'chase') this.spawnConvoy();
    if (step.type === 'enterCar' && step.carType === 'sports' && !this.missionCar) this.spawnMissionCar();
    this.updateMarker();
  }

  spawnMissionCar() {
    if (!this.onSpawnMissionCar) return;
    this.missionCar = this.onSpawnMissionCar();
  }

  spawnMissionDrops(count) {
    if (!this.onSpawnMissionDrops) return;
    this.onSpawnMissionDrops(count);
  }

  spawnGuards(count) {
    if (!this.onSpawnGuards) return;
    this.onSpawnGuards(count);
  }

  spawnConvoy() {
    if (!this.onSpawnConvoy) return;
    this.convoyCar = this.onSpawnConvoy();
  }

  clearConvoy() {
    if (this.convoyCar && this.onClearConvoy) this.onClearConvoy(this.convoyCar);
    this.convoyCar = null;
  }

  updateMarker() {
    const step = this.currentStep();
    if (!step || !this.active) {
      this.marker = null;
      this.effects.clearBeacon();
      return;
    }
    let pos = null;
    if (step.type === 'chase' && this.convoyCar) pos = { x: this.convoyCar.x, z: this.convoyCar.z };
    else if (step.pos) pos = { x: step.pos[0], z: step.pos[1] };
    else if (step.gates) pos = { x: step.gates[this.stepState.gateIndex][0], z: step.gates[this.stepState.gateIndex][1] };
    else if (step.type === 'collect') pos = this.nextDropPosition();
    this.marker = pos;
    if (pos) this.effects.setBeacon(pos.x, pos.z, 0xffd800);
    else this.effects.clearBeacon();
  }

  nextDropPosition() {
    if (this.onNextDropPosition) return this.onNextDropPosition();
    return null;
  }

  stepLabel(step) {
    if (!step) return '';
    let label = step.label || '';
    if (step.type === 'collect') label = label.replace(/\(\d+\/\d+\)/, `(${this.stepState.collected}/${step.count})`);
    if (step.type === 'kill') label = label.replace(/\(\d+\/\d+\)/, `(${this.stepState.killed}/${step.count})`);
    if (step.type === 'hold' && this.stepState.holdTime > 0) {
      label += ` — ${Math.ceil(step.seconds - this.stepState.holdTime)}s`;
    }
    if (step.type === 'chase') {
      const left = Math.max(0, step.seconds - this.stepState.chaseTime);
      label = `Stay on the convoy — ${left.toFixed(0)}s to go`;
    }
    if (step.type === 'race') {
      label = `Hit the checkpoints (${this.stepState.gateIndex}/${step.gates.length}) — ${Math.ceil(this.raceTimeLeft)}s left`;
    }
    return label;
  }

  objectiveText() {
    const mission = this.currentMission();
    if (!mission || !this.active) return { title: 'Free roam', text: '' };
    const step = this.currentStep();
    const minutes = Math.floor(this.missionTime / 60);
    const seconds = Math.floor(this.missionTime % 60);
    const clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
    return { title: `${mission.name} — $${mission.reward}  •  ${clock}`, text: this.stepLabel(step) };
  }

  onMissionDropCollected() {
    const step = this.currentStep();
    if (!step || step.type !== 'collect') return;
    this.stepState.collected += 1;
    this.audio.cashSound();
    this.updateMarker();
    if (this.stepState.collected >= step.count) this.advanceStep();
  }

  onEnemyKilled() {
    const step = this.currentStep();
    if (!step || step.type !== 'kill') return;
    this.stepState.killed += 1;
    if (this.stepState.killed >= step.count) this.advanceStep();
  }

  advanceStep() {
    this.stepIndex += 1;
    this.audio.pickup();
    this.events.push({ type: 'step' });
    if (this.currentStep() && this.currentStep().type !== 'chase') this.clearConvoy();
    this.startStep();
  }

  completeMission() {
    const mission = this.currentMission();
    this.active = false;
    this.clearConvoy();
    this.effects.clearBeacon();
    this.marker = null;
    if (mission && this.dialogue) this.dialogue.sayMissionLines(mission.id, 'end');
    this.events.push({ type: 'complete', mission });
    this.missionIndex += 1;
    if (this.missionIndex >= MISSIONS.length) {
      this.storyComplete = true;
      this.events.push({ type: 'storyComplete' });
    }
  }

  failMission(reason) {
    this.events.push({ type: 'failed', reason: reason || 'Mission failed' });
    this.audio.missionFailed();
    this.active = false;
    this.clearConvoy();
    this.effects.clearBeacon();
    this.marker = null;
  }

  restartMission() {
    if (this.missionIndex < MISSIONS.length) this.startMission(this.missionIndex);
  }

  update(dt, ctx) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    this.missionTime += dt;
    // The talk target turns to face the player when they walk up: the crew
    // is waiting for you, not staring at a wall.
    if (step.type === 'talk') {
      const npc = this.npcs[step.npc];
      if (npc && distance2D(ctx.player.x, ctx.player.z, npc.x, npc.z) < 12) {
        npc.mesh.rotation.y = Math.atan2(ctx.player.x - npc.x, ctx.player.z - npc.z);
      }
    }
    const px = ctx.playerCar ? ctx.playerCar.x : ctx.player.x;
    const pz = ctx.playerCar ? ctx.playerCar.z : ctx.player.z;
    const distTo = (pos) => distance2D(px, pz, pos[0], pos[1]);
    switch (step.type) {
      case 'goto':
      case 'driveTo':
      case 'escape':
        if (distTo(step.pos) < step.radius) this.advanceStep();
        break;
      case 'talk': {
        const npc = this.npcs[step.npc];
        if (npc && distance2D(ctx.player.x, ctx.player.z, npc.x, npc.z) < step.radius && ctx.interactPressed) {
          this.advanceStep();
        }
        break;
      }
      case 'enterCar':
        if (ctx.playerCar && (!step.carType || ctx.playerCar.type === step.carType)) this.advanceStep();
        break;
      case 'hold':
        if (distTo(step.pos) < step.radius && ctx.holdingInteract) {
          this.stepState.holdTime += dt;
          if (this.stepState.holdTime >= step.seconds) this.advanceStep();
        } else {
          this.stepState.holdTime = Math.max(0, this.stepState.holdTime - dt * 2);
        }
        break;
      case 'race': {
        this.raceTimeLeft -= dt;
        if (this.raceTimeLeft <= 0) {
          this.failMission('Out of time — the cops got away with the win.');
          break;
        }
        const gate = step.gates[this.stepState.gateIndex];
        if (gate && distTo(gate) < 12) {
          this.stepState.gateIndex += 1;
          this.audio.pickup();
          if (this.stepState.gateIndex >= step.gates.length) this.advanceStep();
          else this.updateMarker();
        }
        break;
      }
      case 'chase': {
        // Tail the convoy: stay inside the radius to bank time; drift
        // away and the timer drains. The beacon rides the moving car.
        const convoy = this.convoyCar;
        if (!convoy) break;
        this.marker = { x: convoy.x, z: convoy.z };
        this.effects.setBeacon(convoy.x, convoy.z, 0xff4444);
        if (ctx.playerCar) {
          const d = distance2D(px, pz, convoy.x, convoy.z);
          if (d < step.radius) this.stepState.chaseTime += dt;
          else this.stepState.chaseTime = Math.max(0, this.stepState.chaseTime - dt * 1.5);
          if (this.stepState.chaseTime >= step.seconds) this.advanceStep();
        }
        break;
      }
      default:
        break;
    }
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }
}
