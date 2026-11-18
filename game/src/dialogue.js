// Crew dialogue: the people of Solmar City talk back. Lines play at the
// start and end of each story job, and when the player talks to a crewmate,
// in a dialogue box with the speaker's portrait and name. Everyone here is
// an original character — a garage owner, a loudmouth wheelman, a dock fixer,
// a radio host and an ex-cop who knows where the bodies are buried.
export const CREW = {
  lena: { name: 'Lena Cruz', role: 'Garage owner', color: '#c22a2a', initials: 'LC' },
  eddie: { name: 'Big Eddie', role: 'Wheelman', color: '#e8c84a', initials: 'BE' },
  mira: { name: 'Mira Solano', role: 'Street racer', color: '#2a9d8f', initials: 'MS' },
  rico: { name: 'Rico Duarte', role: 'Dock fixer', color: '#4a6a8a', initials: 'RD' },
  nadia: { name: 'Nadia Vale', role: 'Ex-cop informant', color: '#7a4a9a', initials: 'NV' },
  tavares: { name: 'Commissioner Tavares', role: 'The man who owns Solmar', color: '#3a3a3a', initials: 'CT' },
  jax: { name: 'Jax Marlowe', role: 'You', color: '#2a9d8f', initials: 'JM' },
};

// Lines keyed by mission id: 'start' plays when the job opens, 'end' when
// the payout lands. Keep them short — they show in the dialogue box.
export const MISSION_LINES = {
  m1: {
    start: [
      ['lena', 'Jax! You finally showed. Package in the trunk, docks on the other side of town.'],
      ['lena', 'Drive like your grandma is watching — and keep it clean. No heat, no headlines.'],
    ],
    end: [
      ['lena', 'Clean run. See? I told you Solmar rewards a steady wheel.'],
      ['jax', 'Same time tomorrow, boss?'],
    ],
  },
  m2: {
    start: [
      ['lena', 'A cherry-red sports car is sitting outside the Solmar Grand. It is not theirs anymore.'],
      ['eddie', 'Owner calls the cops the second you touch it. Lose them, or outrun them. Your pick.'],
    ],
    end: [
      ['lena', 'She purrs. Eddie, stop drooling on the paint.'],
    ],
  },
  m3: {
    start: [
      ['eddie', 'Jax, my friend! I borrowed a briefcase from the casino. They want it back. Loudly.'],
      ['eddie', 'Pick me up, hit the checkpoints, lose the cops, and nobody asks what was inside.'],
    ],
    end: [
      ['eddie', 'HA! Did you see their faces? You drive like the road owes you money.'],
    ],
  },
  m4: {
    start: [
      ['lena', 'I stashed six cash drops around downtown before the patrols swept my garage.'],
      ['lena', 'Grab them all on foot. The patrols are out, so stay sharp and stay moving.'],
    ],
    end: [
      ['lena', 'Every dollar back. You are the only person in this city I trust with my money.'],
    ],
  },
  m5: {
    start: [
      ['nadia', 'The bank keeps a skeleton crew after midnight. Six seconds on the vault, then run.'],
      ['nadia', 'Tavares owns the courts, Jax. Do not get caught — I cannot buy you out of this one.'],
    ],
    end: [
      ['nadia', 'Four stars and you still walked out. The whole city is talking about you.'],
    ],
  },
  m6: {
    start: [
      ['tavares', 'Mr. Marlowe. You have been a thorn in my city for long enough. My guards will end this.'],
      ['lena', 'That is Tavares himself on the wire. Take his ledger, Jax — tonight Solmar gets a new king.'],
    ],
    end: [
      ['lena', 'The ledger is ours. Tavares is finished, and the city just watched you do it.'],
    ],
  },
  m7: {
    start: [
      ['rico', 'Jax! The harbor master seized four of my crates. Dock workers, manifest, the lot.'],
      ['rico', 'Get my crates off the docks before Tavares burns them. The boat at the pier is waiting.'],
    ],
    end: [
      ['rico', 'All four crates, dry as a Sunday. You are family now, Jax. The harbor is yours.'],
    ],
  },
  m8: {
    start: [
      ['nadia', 'Tavares is running. His convoy leaves the casino at dusk with everything he stole.'],
      ['mira', 'I will pace the convoy and call the turns. You stay on his bumper till he stops. Then we end it.'],
    ],
    end: [
      ['mira', 'He is done. Solmar City finally belongs to the people who live in it.'],
      ['lena', 'King of Solmar, Jax. The garage is yours, the streets are yours. Drive safe.'],
    ],
  },
  // Short barks the crew fires when the player talks to them between jobs.
  // (The wanted-level barks live in DialogueSystem.sayWantedBark.)
  idle: {
    lena: [
      'Garage is open, Jax. Bring me a car worth stealing and I will make it faster.',
      'Tavares owns the courts, but he does not own my wrenches.',
    ],
    eddie: [
      'You see my car out there? Neither do the cops. That is the point.',
      'One day I will drive slow. Today is not that day.',
    ],
    mira: [
      'Beat my time on Palm Boulevard and I will teach you the racing line.',
      'The radio loves you, Jax. The police do not. Funny how that works.',
      'The beach race starts at the west end — bring a fast car and no fear.',
    ],
    rico: [
      'The docks never sleep, Jax. Neither do the harbor master\'s men.',
      'Crates come, crates go. Family stays.',
    ],
    nadia: [
      'I hear everything before the sirens do. Keep your ears open.',
      'Tavares has a file on you, Jax. It gets thicker every week.',
    ],
  },
};

export class DialogueSystem {
  constructor() {
    this.queue = [];
    this.current = null; // { who, name, role, color, initials, text }
    this.timer = 0;
    this.lineSeconds = 4.5;
    this.lastBarkedLevel = 0; // one bark per heat level, not every frame
  }

  // Queue one line from a crew member (by key in CREW).
  say(who, text) {
    const crew = CREW[who];
    if (!crew) return;
    this.queue.push({ who, name: crew.name, role: crew.role, color: crew.color, initials: crew.initials, text });
  }

  // The crew reacts when the heat climbs: Nadia reads the police radio,
  // Lena tells you to run. One bark per level, only when it rises.
  sayWantedBark(level) {
    if (level <= this.lastBarkedLevel) {
      if (level === 0) this.lastBarkedLevel = 0;
      return;
    }
    this.lastBarkedLevel = level;
    const barks = {
      1: ['nadia', 'One star, Jax. A patrol has your plate — shake them before it grows.'],
      2: ['lena', 'Two stars. Lose them on the back streets, do not bring them to my garage.'],
      3: ['nadia', 'Three stars — AIR-1 is spinning up. Keep moving, the beam is looking for you.'],
      4: ['lena', 'Four stars, Jax! The whole city is on you. Drive like you mean it.'],
      5: ['tavares', 'Five stars, Mr. Marlowe. Every unit in Solmar has your name tonight.'],
    };
    const bark = barks[level];
    if (bark) this.say(bark[0], bark[1]);
  }

  // Queue a whole mission's lines for a moment ('start' or 'end').
  sayMissionLines(missionId, moment) {
    const lines = MISSION_LINES[missionId] && MISSION_LINES[missionId][moment];
    if (!lines) return;
    for (const [who, text] of lines) this.say(who, text);
  }

  // Advance the box: show the next queued line, or hide when done.
  update(dt) {
    if (this.current) {
      this.timer -= dt;
      if (this.timer <= 0) this.current = null;
    }
    if (!this.current && this.queue.length > 0) {
      this.current = this.queue.shift();
      this.timer = this.lineSeconds;
    }
  }

  // Skip to the next line immediately (E while a line is showing).
  advance() {
    this.current = null;
    this.timer = 0;
  }

  clear() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
  }
}
