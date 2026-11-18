# Solmar City — sun-soaked coastal crime: 8 story jobs, helicopter police chases, radio, shops, garage, NOS

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Siksuk72/gta6-01-solmar-city-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Siksuk72/gta6-01-solmar-city-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game for make.fun bounty **gta6-01**.
Explore the sun-soaked streets of Solmar City on foot or by car, outrun the
police — including the AIR-1 helicopter — and work your way through eight
story jobs to take over the town.

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

No build step, no network requests — 3D with the vendored three.js +
synthesized WebAudio. Everything (art, sound, music) is generated in code.

## The game

- **City:** an open world to explore on foot and by car, with traffic and
  pedestrians going about their day — golden-hour sun, neon signs, palm-lined
  beach boulevard, districts from Marina Row to Tavares Hill.
- **Wanted level + police:** cause trouble and the heat rises — police cars
  and officers chase you down, roadblocks go up, and at three stars the AIR-1
  helicopter joins with a searchlight. Lose them to cool off.
- **Missions (8):** a story arc of jobs across the city, from a first getaway
  to the final takeover — with a talking crew: Lena, Eddie, Mira, Rico and
  Nadia, each with their own lines.
- **Combat:** fists, pistol, SMG, shotgun and rifle, on foot and from behind
  the wheel.
- **Radio:** three original stations (Solmar FM, Palm Wave, Tide Talk) with
  synthesized grooves — Q changes station, Shift+Q steps back, M toggles the radio.
- **Shops, safehouse & garage:** buy guns and armour at Sunset Arms, heal at
  the Marina Clinic, fit engine/tyre/armour/brake upgrades and NOS at Lena's
  Garage, sleep and save at the safehouse. A shotgun washes up on the pier —
  the free way to unlock weapon slot 4.
- **HUD + minimap:** health, cash, wanted stars, mission tracker with stage
  progress, police-response board, vehicle panel with NOS, weapon slots,
  radio readout, crew dialogue, and a live district minimap.
- **Save:** progress is saved locally, so you can pick up where you left off.
- **Audio:** engine hums, sirens, rotor thump, gunshots and radio — all
  synthesized with WebAudio, no audio files.

## Files

```
game/
  index.html            page shell
  src/
    config.js           constants: city, districts, vehicles, police, story
    random.js           seeded RNG (mulberry32)
    input.js            keyboard/gamepad, hit-testing
    audio.js            WebAudio SFX + radio stations (all synthesized)
    radio.js            the three Solmar City radio stations
    city.js             streets, buildings, neon, palms, beach
    vehicles.js         cars, traffic, driving physics, NOS
    pedestrians.js      pedestrians, wandering and fleeing
    player.js           on-foot movement and combat
    police.js           wanted level, pursuit, roadblocks, response board
    helicopter.js       AIR-1 police helicopter with searchlight
    missions.js         the 8-mission story arc + convoy chase
    dialogue.js         crew dialogue lines and the dialogue box
    combat.js           weapons (fists to rifle), damage, hit feedback
    shops.js            garage upgrades, NOS, safehouse
    camera.js           follow camera
    hud.js              HUD, minimap, screens
    save.js             localStorage save/load
    effects.js          particles, screen shake, skid marks
    world.js            game state, spawning, day flow
    shots.js            deterministic ?shot= scenes for screenshots
    main.js             fixed 60 Hz loop, screen state machine
main.ts                 copies game/ + screenshots/ to /output, writes dossier.json
serve.ts                tiny static server on :8080
shots.json              the 4 screenshots (cover / chase / mission / city)
```

Deterministic screenshot modes: `?shot=cover|chase|mission|city&seed=1` — seeded RNG,
fixed simulated time, `window.__shotReady = true` once drawn. The cover stages
two police flank cars ahead of the getaway car so the chase reads in-frame;
the staged cars drive their own line (`car.staged`) instead of being steered
by the pursuit AI, which would turn them around behind the camera.

## Reviser pass (v2.1)

Final playtest + fixes on top of the v2 build:

- **Garage on foot no longer crashes:** opening Lena's Garage without a car
  used to throw (`upgradesOf(undefined)`); the shop now says plainly to
  bring a car, and a bribe is still on the table.
- **AIR-1 spotlight can actually lock:** the searchlight sweep started 14 m
  out but the lock only grew under 6 m, so SPOTLIGHT was unreachable in real
  play — the lock now builds slowly while the beam sweeps near you.
- **Jacking a moving car is a crime again:** `enterCar` checked the car's
  speed after zeroing it, so it never counted.
- **Bought weapons survive Continue:** saves now store every owned weapon,
  not just the one in hand.
- **Brake kit** at the garage (2 levels), a **shotgun pickup on the pier**,
  crew **barks when the wanted level climbs**, a **mission timer** in the
  HUD, a speed **FOV kick** while driving, sparks on scrapes, and a
  lifeguard tower on the beach.

## Reviser pass (v2.2)

Small final tuning on top of v2.1 — one genuine touch per file, no visual
changes, screenshots unchanged:

- **Taxi tip:** a fare delivered with 30+ s left on the meter pays $25 extra.
- **Heat cools faster** (22 s instead of 25 s) and **police spawn closer**
  (65–90 m), so chases start sooner and end sooner.
- **AIR-1 orbits tighter** (24 m) and **cops fire a touch slower**
  (1.0–1.8 s between shots).
- **Radio:** a sixth SOLMAR FM track, and **Continue restores your station**.
- **Feel:** sharper on-foot turning, a harder handbrake, distance-scaled
  camera zoom, a lower siren wail, brisker pedestrians, a red health bar
  only under 25%, and a bigger particle budget.
- **Fixes:** a key pressed as the window loses focus no longer fires on
  return; staged screenshots pin the clock to golden hour; wheel hubs share
  one material instead of one per wheel; `distance2D` uses `Math.hypot`.
- **Plumbing:** `main.ts` checks for `game/index.html`, `serve.ts` serves
  `.avif`, `shots.json` carries an explicit `seed` per shot.

## Build the submission

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`. Original idea, art, sounds and names; no Rockstar or
GTA assets are used anywhere in this game.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hz26ha21&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
