// Solmar City itself: a sun-soaked coastal grid city built from procedural
// geometry and canvas textures. Roads, sidewalks, buildings, parks, a beach,
// a pier, landmarks and the road graph traffic drives on.
import { CITY } from './config.js';
import { mulberry32, pick, range, rangeInt, chance, clamp } from './random.js';
import { makePalmTree, makeStreetlight, makeCarMesh } from './models.js';

const THREE = window.THREE;

const ROADS = [];
for (let k = 0; k <= CITY.blocks; k += 1) ROADS.push(-CITY.size / 2 + k * CITY.pitch);
const BLOCK_CENTERS = [];
for (let i = 0; i < CITY.blocks; i += 1) BLOCK_CENTERS.push(-CITY.size / 2 + CITY.pitch / 2 + i * CITY.pitch);

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A building facade: warm plaster, rows of windows, some lit, a ground floor
// with a shopfront. `base` is the wall colour, `floors` the window rows.
function facadeTexture(base, floors, seed) {
  const random = mulberry32(seed);
  const cols = 5;
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical shading between window columns.
    for (let c = 0; c < cols; c += 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      if (c % 2 === 0) ctx.fillRect((c * w) / cols, 0, w / cols, h);
    }
    const floorH = (h * 0.86) / floors;
    for (let f = 0; f < floors; f += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = 14 + c * ((w - 28) / cols);
        const y = 10 + f * floorH;
        const lit = random() < 0.25;
        ctx.fillStyle = lit ? '#ffe9a8' : '#20242e';
        ctx.fillRect(x, y, 26, floorH * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x, y, 26, 4);
      }
    }
    // Ground floor shopfront.
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(0, h * 0.88, w, h * 0.12);
    ctx.fillStyle = '#f2c200';
    ctx.fillRect(0, h * 0.88, w, 4);
  });
}

function signTexture(text, bg, fg, subtext) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, subtext ? h / 2 - 18 : h / 2);
    if (subtext) {
      ctx.font = '28px Arial, sans-serif';
      ctx.fillText(subtext, w / 2, h / 2 + 32);
    }
  });
}

function neonSignTexture(text, color) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#14101c';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
  });
}

function roadTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#2e2e33';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2c200';
    ctx.fillRect(w / 2 - 3, 0, 6, h);
    ctx.fillStyle = '#e8e8e8';
    for (let y = 0; y < h; y += 64) ctx.fillRect(8, y, 5, 34);
    for (let y = 0; y < h; y += 64) ctx.fillRect(w - 13, y, 5, 34);
  });
}

const FACADE_COLORS = ['#e8a56b', '#d98a7a', '#c9b18a', '#a8b8c8', '#e0cfa8', '#b98a9a', '#8fb8a8', '#d9c28a', '#e8956b', '#d97a5a', '#c98a6a', '#f0b070'];
const FACADE_TEXTURES = [];

export function buildCity(scene) {
  const random = mulberry32(CITY.seed);
  const halfRoad = CITY.road / 2; // reused by isOnRoad below
  const city = {
    colliders: [],
    solidMeshes: [],
    intersections: [],
    carSpawns: [],
    pedSpawns: [],
    collectibleSpots: [],
    clouds: [],
    ocean: null,
    landmarks: {},
    roadAt: (x) => ROADS.reduce((best, r) => (Math.abs(r - x) < Math.abs(best - x) ? r : best), ROADS[0]),
    isOnRoad: (x, z) => ROADS.some((r) => Math.abs(x - r) < halfRoad) || ROADS.some((r) => Math.abs(z - r) < halfRoad),
  };

  for (let i = 0; i < 6; i += 1) {
    FACADE_TEXTURES.push(facadeTexture(pick(random, FACADE_COLORS), rangeInt(random, 4, 9), 100 + i * 17));
  }

  // --- sky, sun and light: low golden-hour sun over the ocean ---
  scene.background = new THREE.Color(0xffbe78);
  scene.fog = new THREE.Fog(0xffc890, 220, 700);
  const sun = new THREE.DirectionalLight(0xffc98a, 1.7);
  sun.position.set(-260, 140, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x9a8a6a, 0.9));

  // --- ground: sand base, ocean to the west, beach strip ---
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a8 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.05;
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(700, 1600),
    new THREE.MeshLambertMaterial({ color: 0x2a7a9e }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-CITY.size / 2 - 350, 0.02, 0);
  scene.add(ocean);
  city.ocean = ocean;
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(46, CITY.size + 60),
    new THREE.MeshLambertMaterial({ color: 0xf2e2b8 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-CITY.size / 2 - 20, 0.01, 0);
  scene.add(beach);

  // --- clouds ---
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(range(random, 6, 12), 8, 6), cloudMat);
      puff.position.set(j * 9 - 14 + random() * 4, random() * 2, random() * 6 - 3);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(range(random, -350, 350), range(random, 90, 140), range(random, -350, 350));
    scene.add(cloud);
    city.clouds.push(cloud);
  }

  // --- roads and sidewalks ---
  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, CITY.size / 58);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  // Horizontal roads need the same texture turned 90 degrees so the centre
  // line runs along the road instead of across it.
  const roadTexH = roadTexture();
  roadTexH.wrapS = THREE.RepeatWrapping;
  roadTexH.wrapT = THREE.RepeatWrapping;
  roadTexH.repeat.set(1, CITY.size / 58);
  roadTexH.center.set(0.5, 0.5);
  roadTexH.rotation = Math.PI / 2;
  const roadMatH = new THREE.MeshLambertMaterial({ map: roadTexH });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
  for (const c of ROADS) {
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, CITY.size), roadMat);
    vertical.rotation.x = -Math.PI / 2;
    vertical.position.set(c, 0.03, 0);
    vertical.receiveShadow = true;
    scene.add(vertical);
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, CITY.road), roadMatH);
    horizontal.rotation.x = -Math.PI / 2;
    horizontal.position.set(0, 0.03, c);
    horizontal.receiveShadow = true;
    scene.add(horizontal);
    // Sidewalk strips on both sides of each road.
    for (const side of [-1, 1]) {
      const walkV = new THREE.Mesh(new THREE.PlaneGeometry(3, CITY.size), sidewalkMat);
      walkV.rotation.x = -Math.PI / 2;
      walkV.position.set(c + side * (CITY.road / 2 + 1.5), 0.05, 0);
      scene.add(walkV);
      const walkH = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, 3), sidewalkMat);
      walkH.rotation.x = -Math.PI / 2;
      walkH.position.set(0, 0.05, c + side * (CITY.road / 2 + 1.5));
      scene.add(walkH);
    }
  }
  for (const rx of ROADS) {
    for (const rz of ROADS) city.intersections.push({ x: rx, z: rz });
  }

  // --- blocks: buildings, parks, parking lots ---
  const blockSize = CITY.pitch - CITY.road; // 44
  const landmarkBlocks = {
    '3,7': 'garage', '6,7': 'gunstore', '2,4': 'clinic', '4,6': 'bank',
    '7,2': 'casino', '6,5': 'hotel', '8,1': 'mansion', '1,7': 'safehouse',
  };
  const openBlocks = new Set(['8,4', '0,1', '4,4']); // docks plaza, pier plaza, central park
  const parkBlocks = new Set(['1,1', '7,7', '4,4']);

  const buildingGeoms = new Map();
  function buildingBox(w, h, d) {
    const key = `${w}x${h}x${d}`;
    if (!buildingGeoms.has(key)) buildingGeoms.set(key, new THREE.BoxGeometry(w, h, d));
    return buildingGeoms.get(key);
  }

  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const cx = BLOCK_CENTERS[i];
      const cz = BLOCK_CENTERS[j];
      const key = `${i},${j}`;
      // Block ground slab.
      const slabColor = parkBlocks.has(key) ? 0x6a9a4a : 0x8a8a80;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(blockSize, blockSize),
        new THREE.MeshLambertMaterial({ color: slabColor }));
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(cx, 0.04, cz);
      slab.receiveShadow = true;
      scene.add(slab);

      if (openBlocks.has(key)) {
        // Open plaza / parking: a few parked cars, no buildings.
        const parked = rangeInt(random, 3, 6);
        for (let p = 0; p < parked; p += 1) {
          const car = makeCarMesh(pick(random, ['sedan', 'sedan', 'van', 'sports']));
          car.position.set(cx + range(random, -16, 16), 0, cz + range(random, -16, 16));
          car.rotation.y = pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
          scene.add(car);
        }
        continue;
      }
      if (parkBlocks.has(key)) {
        for (let t = 0; t < 8; t += 1) {
          const palm = makePalmTree(range(random, 0.9, 1.3));
          palm.position.set(cx + range(random, -18, 18), 0, cz + range(random, -18, 18));
          scene.add(palm);
        }
        const pond = new THREE.Mesh(new THREE.CircleGeometry(6, 20),
          new THREE.MeshLambertMaterial({ color: 0x3a8ab0 }));
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(cx + 8, 0.06, cz - 6);
        scene.add(pond);
        continue;
      }

      const landmark = landmarkBlocks[key];
      const distCenter = Math.sqrt(cx * cx + cz * cz) / (CITY.size / 2);
      const downtown = 1 - clamp(distCenter, 0, 1);
      const count = landmark ? 1 : chance(random, 0.55) ? 1 : rangeInt(random, 2, 4);
      for (let b = 0; b < count; b += 1) {
        const w = count === 1 ? range(random, 26, 36) : range(random, 14, 20);
        const d = count === 1 ? range(random, 26, 36) : range(random, 14, 20);
        const h = landmark ? (landmark === 'hotel' ? 64 : landmark === 'mansion' ? 14 : 12)
          : Math.round((10 + downtown * 46 + random() * 14) / 2) * 2;
        const bx = count === 1 ? cx : cx + (b % 2 === 0 ? -9 : 9);
        const bz = count === 1 ? cz : cz + (b < 2 ? -9 : 9);
        const tex = pick(random, FACADE_TEXTURES);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const building = new THREE.Mesh(buildingBox(w, h, d), mat);
        building.position.set(bx, h / 2, bz);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        city.solidMeshes.push(building);
        // Rooftop unit.
        const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 3),
          new THREE.MeshLambertMaterial({ color: 0x777777 }));
        roof.position.set(bx + 4, h + 0.7, bz - 4);
        scene.add(roof);
        city.colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
        if (landmark) {
          city.landmarks[landmark] = { x: bx, z: bz, w, d, h };
          addSign(scene, landmark, bx, bz, h, w, d);
        }
      }
      // A palm or two on the block corner.
      if (chance(random, 0.6)) {
        const palm = makePalmTree(range(random, 0.8, 1.1));
        palm.position.set(cx + 19, 0, cz + 19);
        scene.add(palm);
      }
    }
  }

  // --- pier: wooden deck into the ocean at the west edge ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let p = 0; p < 14; p += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 8), pierMat);
    plank.position.set(-CITY.size / 2 - 8 - p * 8, 1.2, -232);
    scene.add(plank);
  }
  const pierEnd = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 20), pierMat);
  pierEnd.position.set(-CITY.size / 2 - 118, 1.2, -232);
  scene.add(pierEnd);

  // --- streetlights at intersections ---
  for (const { x, z } of city.intersections) {
    if (chance(random, 0.5)) {
      const light = makeStreetlight();
      light.position.set(x + CITY.road / 2 + 1, 0, z + CITY.road / 2 + 1);
      scene.add(light);
    }
  }

  // --- neon signs: glowing vertical boards on downtown corners ---
  const NEON_SIGNS = [
    ['PALMS', '#ff5ad0', -87, -29], ['TACOS', '#ffdd33', 29, 29], ['BAR', '#33eeff', 87, 87],
    ['24H', '#66ff66', -29, -87], ['PIER', '#ff8844', -203, -203], ['HOTEL', '#ff5ad0', 145, -87],
    ['SURF', '#33eeff', -145, 203], ['DANCE', '#ffdd33', 29, -145], ['CASINO', '#ff5ad0', 87, -203],
    ['BEACH', '#66ff66', -203, 145],
  ];
  for (const [text, color, sx, sz] of NEON_SIGNS) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pole.position.set(sx, 3.5, sz);
    scene.add(pole);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(text, color) }));
    board.position.set(sx, 8.2, sz);
    board.rotation.y = Math.PI / 4;
    scene.add(board);
    city.colliders.push({ minX: sx - 0.4, maxX: sx + 0.4, minZ: sz - 0.4, maxZ: sz + 0.4 });
  }

  // --- beach boulevard: a double row of palms along the ocean avenue ---
  for (let z = -240; z <= 240; z += 26) {
    for (const side of [-272, -250]) {
      const palm = makePalmTree(range(random, 1.0, 1.4));
      palm.position.set(side + range(random, -1.5, 1.5), 0, z + range(random, -3, 3));
      scene.add(palm);
    }
  }

  // --- beach umbrellas: colour pops on the sand west of the avenue ---
  const umbrellaColors = [0xff5a5a, 0xffdd33, 0x33ccff, 0xff5ad0, 0x66ff66];
  for (let u = 0; u < 10; u += 1) {
    const ux = range(random, -296, -276);
    const uz = range(random, -240, 240);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6),
      new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
    pole.position.set(ux, 1.2, uz);
    scene.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 8),
      new THREE.MeshLambertMaterial({ color: pick(random, umbrellaColors) }));
    canopy.position.set(ux, 2.7, uz);
    scene.add(canopy);
  }

  // --- lifeguard tower: four legs, a hut and a red flag, mid-beach ---
  const tower = new THREE.Group();
  const legMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 6), legMat);
    leg.position.set(lx, 1.8, lz);
    leg.rotation.z = lx > 0 ? -0.12 : 0.12;
    leg.rotation.x = lz > 0 ? 0.12 : -0.12;
    tower.add(leg);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 3.0),
    new THREE.MeshLambertMaterial({ color: 0xff5a5a }));
  hut.position.y = 4.2;
  hut.castShadow = true;
  tower.add(hut);
  const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.0, 4),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8 }));
  hutRoof.position.y = 5.5;
  hutRoof.rotation.y = Math.PI / 4;
  tower.add(hutRoof);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  flagPole.position.set(1.2, 6.4, -1.0);
  tower.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xd4202a, side: THREE.DoubleSide }));
  flag.position.set(1.78, 7.2, -1.0);
  tower.add(flag);
  tower.position.set(-282, 0, 60);
  scene.add(tower);

  // --- car / ped spawn points along roads ---
  for (let s = 0; s < 40; s += 1) {
    const road = pick(random, ROADS);
    const along = range(random, -CITY.size / 2 + 20, CITY.size / 2 - 20);
    const vertical = chance(random, 0.5);
    city.carSpawns.push({
      x: vertical ? road + (chance(random, 0.5) ? 3.5 : -3.5) : along,
      z: vertical ? along : road + (chance(random, 0.5) ? 3.5 : -3.5),
      heading: vertical ? (chance(random, 0.5) ? 0 : Math.PI) : (chance(random, 0.5) ? Math.PI / 2 : -Math.PI / 2),
    });
  }
  for (let s = 0; s < 60; s += 1) {
    const road = pick(random, ROADS);
    const along = range(random, -CITY.size / 2 + 10, CITY.size / 2 - 10);
    const vertical = chance(random, 0.5);
    city.pedSpawns.push({
      x: vertical ? road + (chance(random, 0.5) ? 8.5 : -8.5) : along,
      z: vertical ? along : road + (chance(random, 0.5) ? 8.5 : -8.5),
    });
  }
  return city;
}

const SIGN_DEFS = {
  garage: ['LENA\'S GARAGE', '#c22a2a', '#ffe9a8', 'REPAIRS • NO QUESTIONS'],
  gunstore: ['SUNSET ARMS', '#222222', '#f2c200', 'GUNS • AMMO • ARMOR'],
  clinic: ['MARINA CLINIC', '#2a7a6a', '#ffffff', 'PATCH UP • WALK-INS'],
  bank: ['SOLMAR NATIONAL BANK', '#5a4a2a', '#ffe9a8', 'EST. 1962'],
  casino: ['MARINA CASINO', '#7a1a6a', '#ffd800', 'SLOTS • CARDS • ALL NIGHT'],
  hotel: ['SOLMAR GRAND', '#8a5a2a', '#ffffff', 'HOTEL • ROOFTOP BAR'],
  mansion: ['TAVARES ESTATE', '#3a3a3a', '#e8e8e8', 'PRIVATE'],
  safehouse: ['SAFEHOUSE', '#2a4a7a', '#ffffff', 'LENAS CREW ONLY'],
};

function addSign(scene, landmark, bx, bz, h, w, d) {
  const def = SIGN_DEFS[landmark];
  if (!def) return;
  const texture = signTexture(def[0], def[1], def[2], def[3]);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 22), 5.5),
    new THREE.MeshLambertMaterial({ map: texture }));
  // Face the nearest road (south side by default).
  sign.position.set(bx, Math.min(h - 3, 9), bz + d / 2 + 0.15);
  scene.add(sign);
}
