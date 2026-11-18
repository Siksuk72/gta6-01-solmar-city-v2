// Procedural 3D models built from boxes, cylinders and canvas textures.
// Every mesh is original geometry made in code — no imported assets.
// three.js is loaded as a classic script in index.html (game/vendor/three.min.js),
// so the global THREE namespace is available to every module.
const THREE = window.THREE;

export const CAR_COLORS = {
  sedan: [0x3a6ea5, 0x8a2f2f, 0x5a5a5a, 0x2f6e4a, 0xb8b0a0, 0x37474f],
  sports: [0xd4202a, 0xff8c00, 0x1a1a2e, 0x0f7a6e, 0xe8e8e8, 0x7a2a8a],
  taxi: [0xf2c200],
  truck: [0x7a7a7a, 0x8a5a2a, 0x3a5a7a],
  police: [0x111418],
  van: [0x4a6a8a, 0x8a8a8a, 0x5a3a6a],
};

export const CAR_SPECS = {
  sedan: { length: 4.4, width: 1.9, height: 0.85, cabinH: 0.7, topSpeed: 34, accel: 24, color: 'sedan' },
  sports: { length: 4.2, width: 1.95, height: 0.7, cabinH: 0.55, topSpeed: 48, accel: 32, color: 'sports' },
  taxi: { length: 4.4, width: 1.9, height: 0.85, cabinH: 0.7, topSpeed: 33, accel: 23, color: 'taxi' },
  truck: { length: 6.2, width: 2.3, height: 1.5, cabinH: 1.1, topSpeed: 26, accel: 16, color: 'truck' },
  police: { length: 4.5, width: 1.95, height: 0.85, cabinH: 0.7, topSpeed: 42, accel: 30, color: 'police' },
  van: { length: 5.2, width: 2.1, height: 1.4, cabinH: 0.9, topSpeed: 28, accel: 18, color: 'van' },
};

const bodyMaterialCache = new Map();
function bodyMaterial(color) {
  if (!bodyMaterialCache.has(color)) {
    bodyMaterialCache.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return bodyMaterialCache.get(color);
}
const glassMaterial = new THREE.MeshLambertMaterial({ color: 0x1a2a33 });
const tyreMaterial = new THREE.MeshLambertMaterial({ color: 0x141414 });
// One shared hub material: the old code built a fresh one per wheel, four
// per car, for a part that never changes colour.
const hubMaterial = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
const lightFrontMaterial = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x555533 });
const lightRearMaterial = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x440000 });

function makeWheel(radius, width) {
  const wheel = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 12), tyreMaterial);
  tyre.rotation.z = Math.PI / 2;
  wheel.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 10),
    hubMaterial);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  return wheel;
}

// A car mesh. `type` is one of CAR_SPECS keys. Returns a Group whose
// userData holds wheel references and the light-bar (police) / taxi sign.
export function makeCarMesh(type, colorHex) {
  const spec = CAR_SPECS[type] || CAR_SPECS.sedan;
  const color = colorHex !== undefined ? colorHex : CAR_COLORS[spec.color][0];
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.width, spec.height, spec.length), bodyMaterial(color));
  body.position.y = 0.55 + spec.height / 2;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.82, spec.cabinH, spec.length * 0.48), glassMaterial);
  cabin.position.set(0, 0.55 + spec.height + spec.cabinH / 2 - 0.05, type === 'truck' ? spec.length * 0.22 : -spec.length * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  // Hood / trunk hint for trucks and vans.
  if (type === 'truck' || type === 'van') {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.94, spec.height * 0.9, spec.length * 0.42),
      bodyMaterial(color));
    cargo.position.set(0, 0.55 + spec.height * 0.45 + 0.1, -spec.length * 0.24);
    cargo.castShadow = true;
    group.add(cargo);
  }
  const wheelR = type === 'truck' ? 0.48 : 0.36;
  const wheelW = 0.28;
  const wheelPositions = [
    [-spec.width / 2, spec.length * 0.32], [spec.width / 2, spec.length * 0.32],
    [-spec.width / 2, -spec.length * 0.32], [spec.width / 2, -spec.length * 0.32],
  ];
  const wheels = [];
  for (const [wx, wz] of wheelPositions) {
    const wheel = makeWheel(wheelR, wheelW);
    wheel.position.set(wx, wheelR, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const frontLight = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.8, 0.16, 0.08), lightFrontMaterial);
  frontLight.position.set(0, 0.85, spec.length / 2 + 0.02);
  group.add(frontLight);
  const rearLight = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.8, 0.16, 0.08), lightRearMaterial);
  rearLight.position.set(0, 0.85, -spec.length / 2 - 0.02);
  group.add(rearLight);
  // Sports cars get a rear spoiler: two small struts and a wing, so the
  // Comet GT reads as the fast car even standing still.
  if (type === 'sports') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.9, 0.07, 0.42), bodyMaterial(color));
    wing.position.set(0, 1.32, -spec.length / 2 + 0.28);
    wing.castShadow = true;
    group.add(wing);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.08), bodyMaterial(color));
      strut.position.set(side * (spec.width * 0.32), 1.14, -spec.length / 2 + 0.28);
      group.add(strut);
    }
  }
  let lightBar = null;
  let taxiSign = null;
  if (type === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x880000 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x000088 }));
    blue.position.x = 0.3;
    lightBar.add(red, blue);
    lightBar.position.set(0, 0.55 + spec.height + spec.cabinH + 0.05, 0);
    lightBar.userData.red = red;
    lightBar.userData.blue = blue;
    group.add(lightBar);
    // White doors: two thin white boxes on the sides.
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.7, 1.6),
        new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
      door.position.set(side * (spec.width / 2 + 0.01), 0.95, 0);
      group.add(door);
    }
  }
  if (type === 'taxi') {
    taxiSign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffd800, emissive: 0x665500 }));
    taxiSign.position.set(0, 0.55 + spec.height + spec.cabinH + 0.08, 0);
    group.add(taxiSign);
  }
  group.userData = { wheels, lightBar, taxiSign, spec, type, wheelR };
  return group;
}

// A simple low-poly person: torso, head, arms, legs. `palette` picks shirt,
// pants and skin colours. userData holds limb references for walk animation.
export function makePersonMesh(palette) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: palette.skin });
  const shirt = new THREE.MeshLambertMaterial({ color: palette.shirt });
  const pants = new THREE.MeshLambertMaterial({ color: palette.pants });
  const hair = new THREE.MeshLambertMaterial({ color: palette.hair || 0x2a1a0a });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.16), pants);
  legL.position.set(-0.11, 0.375, 0);
  const legR = legL.clone();
  legR.position.x = 0.11;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), shirt);
  torso.position.y = 1.06;
  torso.castShadow = true;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.13), shirt);
  armL.position.set(-0.33, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.33;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.32), hair);
  hairMesh.position.y = 1.72;
  group.add(legL, legR, torso, armL, armR, head, hairMesh);
  // Pivot the limbs at the top so they swing like a walk.
  legL.geometry.translate(0, -0.375, 0);
  legL.position.y = 0.75;
  legR.geometry.translate(0, -0.375, 0);
  legR.position.y = 0.75;
  armL.geometry.translate(0, -0.3, 0);
  armL.position.y = 1.35;
  armR.geometry.translate(0, -0.3, 0);
  armR.position.y = 1.35;
  group.userData = { legL, legR, armL, armR, torso, head };
  return group;
}

export const PERSON_PALETTES = [
  { shirt: 0xd95555, pants: 0x2a3a55, skin: 0xc98e6a },
  { shirt: 0x4a90d9, pants: 0x333333, skin: 0x8a5a3a },
  { shirt: 0x55aa55, pants: 0x555555, skin: 0xe8b88a },
  { shirt: 0xe8c84a, pants: 0x2a2a2a, skin: 0xc98e6a },
  { shirt: 0xaa55cc, pants: 0x3a3a3a, skin: 0x6a4530 },
  { shirt: 0xeeeeee, pants: 0x1a2a4a, skin: 0xe8b88a },
  { shirt: 0xff8855, pants: 0x224422, skin: 0x8a5a3a },
  { shirt: 0x55cccc, pants: 0x553322, skin: 0xc98e6a },
];

export const PLAYER_PALETTE = { shirt: 0x2a9d8f, pants: 0x223344, skin: 0xc98e6a, hair: 0x1a1a1a };
export const COP_PALETTE = { shirt: 0x1a2a4a, pants: 0x1a2a4a, skin: 0xc98e6a, hair: 0x111111 };
export const GUARD_PALETTE = { shirt: 0x333333, pants: 0x222222, skin: 0x8a5a3a, hair: 0x000000 };

// A palm tree: curved trunk and a crown of flat leaves.
export function makePalmTree(scale) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 3.4, 7),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  trunk.position.y = 1.7;
  trunk.rotation.z = 0.08;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b3a, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), leafMat);
    const angle = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.9, 3.5, Math.sin(angle) * 0.9);
    leaf.rotation.set(0.5, -angle, 0);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = -angle + Math.PI / 2;
    leaf.rotation.x = -0.6;
    group.add(leaf);
  }
  const coconuts = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }));
  coconuts.position.set(0.2, 3.35, 0);
  group.add(coconuts);
  group.scale.setScalar(scale || 1);
  return group;
}

export function makeStreetlight() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x333a44 }));
  pole.position.y = 2.7;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x333a44 }));
  arm.position.set(0.6, 5.3, 0);
  group.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 }));
  lamp.position.set(1.25, 5.25, 0);
  group.add(lamp);
  return group;
}
