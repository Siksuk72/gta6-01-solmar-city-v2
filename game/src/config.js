// Solmar City — configuration: city layout, tuning, story missions, names.
// Everything here is original: a fictional sun-soaked coastal city, its people
// and its story. Nothing is taken from any commercial game.
export const CITY = {
  blocks: 9, // blocks per side
  pitch: 58, // block + road width
  road: 14, // road width
  size: 9 * 58, // total city span in world units
  seed: 7,
};

export const TUNE = {
  playerWalkSpeed: 7,
  playerRunSpeed: 11,
  playerJump: 8.5,
  gravity: 24,
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 46,
  carMaxReverse: 14,
  carSteer: 1.9,
  carGrip: 6.5,
  trafficCount: 16,
  pedCount: 26,
  policeResponseTime: 2.5,
  wantedDecaySeconds: 22, // heat cools a little faster than the old 25 s: hiding out
  // after a chase used to mean a long dead stretch with nothing to do
  bulletDamage: 34,
  guardHealth: 100,
  copHealth: 80,
  playerHealth: 100,
};

export const PLAYER_START = { x: -40, z: 120 };

// Districts: named neighbourhoods the HUD shows as you drive through them.
export const DISTRICTS = [
  { name: 'Beachfront', minX: -320, maxX: -232, minZ: -320, maxZ: 320 },
  { name: 'Marina Row', minX: -232, maxX: -58, minZ: 87, maxZ: 261 },
  { name: 'Old Town', minX: -232, maxX: -58, minZ: -261, maxZ: 87 },
  { name: 'Downtown', minX: -58, maxX: 145, minZ: -58, maxZ: 145 },
  { name: 'Casino Row', minX: 29, maxX: 203, minZ: -203, maxZ: -58 },
  { name: 'Tavares Hill', minX: 145, maxX: 261, minZ: -261, maxZ: -145 },
  { name: 'The Docks', minX: 145, maxX: 261, minZ: -145, maxZ: 145 },
  { name: 'Palm Heights', minX: -58, maxX: 261, minZ: 145, maxZ: 261 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.minX && x < d.maxX && z >= d.minZ && z < d.maxZ) return d.name;
  }
  return 'Solmar City';
}

export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, mag: 0, reserve: 0, fireRate: 0.35, range: 2.6, spread: 0, auto: false, melee: true },
  pistol: { name: 'Pistol', damage: 34, mag: 12, reserve: 9999, fireRate: 0.22, range: 90, spread: 0.012, auto: false },
  smg: { name: 'SMG', damage: 18, mag: 32, reserve: 9999, fireRate: 0.085, range: 70, spread: 0.03, auto: true },
  shotgun: { name: 'Shotgun', damage: 16, mag: 6, reserve: 9999, fireRate: 0.8, range: 32, spread: 0.09, pellets: 7, auto: false },
  rifle: { name: 'Rifle', damage: 55, mag: 10, reserve: 9999, fireRate: 0.55, range: 140, spread: 0.004, auto: false },
};

// Five slots, 1–5 on the keyboard. Fists are always owned; the rest are
// bought at Sunset Arms or found on the street.
export const WEAPON_SLOTS = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];

// Weapons lying around the city, free for the taking. The shotgun has no
// shop stock on the street — one washes up on the pier, and it is the only
// way to unlock slot 4 without paying Sunset Arms $600.
export const WEAPON_PICKUPS = [
  { weapon: 'shotgun', x: -261, z: -232, label: 'Shotgun — washed up on the pier' },
];

// Story: Jax Marlowe, a wheelman new to Solmar City, works his way up from
// Lena Cruz's garage crew to the top of the city's underworld — with Mira
// Solano on the streets, Rico Duarte on the docks and Nadia Vale feeding
// him what the police know before they know it themselves.
export const STORY = {
  title: 'SOLMAR CITY',
  subtitle: 'Sun, salt air, and stolen cars.',
  intro:
    'Jax Marlowe just rolled into Solmar City with an empty wallet and a fast right foot. ' +
    'Lena Cruz runs a garage on Marina Row and always needs a driver who asks no questions. ' +
    'Do her jobs, earn her trust, and take the city — one getaway at a time.',
  characters: {
    lena: 'Lena Cruz — garage owner, fixer, the only honest crook in Solmar.',
    eddie: 'Big Eddie — a loudmouth with a louder car and a debt to collect.',
    mira: 'Mira Solano — street racer, radio host, the fastest thing on Palm Boulevard.',
    rico: 'Rico Duarte — dock fixer; if it came by sea, Rico has seen it.',
    nadia: 'Nadia Vale — ex-cop informant who hears everything before the sirens do.',
    tavares: 'Commissioner Tavares — owns the police, the port, and half the skyline.',
  },
};

// Mission steps. Types: goto, talk, enterCar, driveTo, collect, kill, hold,
// race, escape, chase (stay on a moving convoy car for N seconds).
export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Job',
    briefing:
      'Lena needs a package moved across town. Meet her at the garage on Marina Row, then drive the package to the drop-off at the docks. Keep it clean.',
    reward: 500,
    steps: [
      { type: 'goto', label: 'Meet Lena at the garage', pos: [-87, 145], radius: 6 },
      { type: 'talk', label: 'Talk to Lena (E)', npc: 'lena', pos: [-87, 145], radius: 5 },
      { type: 'enterCar', label: 'Get in a car', any: true },
      { type: 'driveTo', label: 'Drive the package to the docks', pos: [203, -29], radius: 10 },
    ],
  },
  {
    id: 'm2',
    name: 'Hot Wheels',
    briefing:
      'A cherry-red sports car is parked outside the Solmar Grand hotel. Steal it and bring it to Lena\'s garage. The owner will call the cops — lose them or outrun them.',
    reward: 900,
    steps: [
      { type: 'goto', label: 'Find the sports car at the Solmar Grand', pos: [145, 29], radius: 8 },
      { type: 'enterCar', label: 'Steal the sports car', carType: 'sports', pos: [145, 29], radius: 6 },
      { type: 'driveTo', label: 'Bring it to Lena\'s garage', pos: [-87, 145], radius: 10, wanted: 2 },
    ],
  },
  {
    id: 'm3',
    name: 'Getaway Driver',
    briefing:
      'Big Eddie just "borrowed" a briefcase from the casino. Pick him up outside the casino, then hit all five checkpoints and lose the cops before you reach the safehouse.',
    reward: 1500,
    steps: [
      { type: 'goto', label: 'Pick up Big Eddie at the casino', pos: [87, -145], radius: 8 },
      { type: 'talk', label: 'Talk to Eddie (E)', npc: 'eddie', pos: [87, -145], radius: 5 },
      { type: 'race', label: 'Hit the checkpoints and lose the cops', gates: [[29, -87], [87, -87], [87, 29], [29, 87], [-87, 87]], wanted: 3 },
      { type: 'driveTo', label: 'Reach the safehouse', pos: [-203, 203], radius: 10 },
    ],
  },
  {
    id: 'm4',
    name: 'The Collector',
    briefing:
      'Lena stashed six cash drops around downtown before the cops swept her garage. Grab them all on foot — the patrols are out, so stay sharp and stay moving.',
    reward: 1800,
    steps: [
      { type: 'collect', label: 'Collect the cash drops (0/6)', count: 6, wanted: 2 },
    ],
  },
  {
    id: 'm5',
    name: 'Bank Job',
    briefing:
      'The Solmar National Bank keeps a fortune in its vault and a skeleton crew after midnight. Get in, grab the cash, and get out. The whole city will be looking for you.',
    reward: 3500,
    steps: [
      { type: 'driveTo', label: 'Drive to the Solmar National Bank', pos: [29, 87], radius: 10 },
      { type: 'hold', label: 'Crack the vault — hold E', pos: [29, 87], radius: 8, seconds: 6 },
      { type: 'escape', label: 'Escape to the pier safehouse', pos: [-261, -232], radius: 12, wanted: 4 },
    ],
  },
  {
    id: 'm6',
    name: 'King of Solmar',
    briefing:
      'Commissioner Tavares runs this city from his mansion on the hill. Take out his guards, take his ledger, and drive the evidence to the pier. Tonight, Solmar gets a new king.',
    reward: 5000,
    steps: [
      { type: 'driveTo', label: 'Drive to the Tavares mansion', pos: [203, -203], radius: 12 },
      { type: 'kill', label: 'Clear the mansion guards (0/8)', count: 8, wanted: 4 },
      { type: 'enterCar', label: 'Get in the getaway car', any: true },
      { type: 'driveTo', label: 'Deliver the ledger to the pier', pos: [-261, -232], radius: 12 },
    ],
  },
  {
    id: 'm7',
    name: 'Harbor Lights',
    briefing:
      'Rico Duarte runs the docks, and the harbor master just seized four of his crates. Meet Rico at the docks, grab the crates before Tavares burns them, and get them to the boat at the pier.',
    reward: 6000,
    steps: [
      { type: 'goto', label: 'Meet Rico at the docks', pos: [203, -29], radius: 8 },
      { type: 'talk', label: 'Talk to Rico (E)', npc: 'rico', pos: [203, -29], radius: 5 },
      { type: 'collect', label: 'Recover the seized crates (0/4)', count: 4, wanted: 3 },
      { type: 'escape', label: 'Escape to the boat at the pier', pos: [-261, -232], radius: 12, wanted: 4 },
    ],
  },
  {
    id: 'm8',
    name: 'Crown of the Coast',
    briefing:
      'Tavares is running. His convoy leaves the casino at dusk with everything he stole from this city. Nadia knows the route, Mira will pace the convoy — stay on his bumper until he stops, then take the ledger and finish it at the pier.',
    reward: 8000,
    steps: [
      { type: 'driveTo', label: 'Drive to the casino', pos: [87, -145], radius: 10 },
      { type: 'talk', label: 'Talk to Nadia (E)', npc: 'nadia', pos: [116, -116], radius: 5 },
      { type: 'enterCar', label: 'Get in a car', any: true },
      { type: 'chase', label: 'Stay on the Tavares convoy (hold close)', seconds: 8, radius: 18, wanted: 4 },
      { type: 'driveTo', label: 'Deliver the ledger to the pier', pos: [-261, -232], radius: 12 },
    ],
  },
];

export const ACTIVITIES = {
  taxiFareBase: 60,
  taxiFarePerMetre: 0.9,
  raceReward: 800,
  collectibleValue: 150,
  collectibleCount: 24,
  ammoPrice: 50,
  armorPrice: 120,
  healPrice: 80,
  repairPrice: 100,
  bribePrice: 250,
  riflePrice: 900,
};

export const SHOPS = [
  { id: 'gunstore', name: 'Sunset Arms', kind: 'guns', pos: [58, 145], label: 'Sunset Arms — guns & armor' },
  { id: 'clinic', name: 'Marina Clinic', kind: 'clinic', pos: [-145, -29], label: 'Marina Clinic — patch up' },
  { id: 'garage', name: "Lena's Garage", kind: 'garage', pos: [-87, 145], label: "Lena's Garage — upgrades, NOS & repairs" },
  { id: 'safehouse', name: "Lena's Safehouse", kind: 'safehouse', pos: [-203, 203], label: 'Safehouse — sleep, save & heal' },
  { id: 'race', name: 'Beach Race Start', kind: 'race', pos: [-203, 87], label: 'Beach Race — press E to race' },
];

export const WANTED_NAMES = ['', 'One star', 'Two stars', 'Three stars', 'Four stars', 'Five stars'];
