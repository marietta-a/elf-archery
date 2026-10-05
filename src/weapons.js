import * as THREE from 'three';

export const BOWS = [
  { id: 'elven', name: 'Elven Longbow', cost: 0, blurb: 'Carved heartwood. Uses your arrow pack.' },
  { id: 'steampunk', name: 'Steampunk Ballista', cost: 400, blurb: 'Clockwork bolts, steam hiss.' },
  { id: 'laser', name: 'Laser Crossbow', cost: 700, blurb: 'Fires a beam of light.' },
  { id: 'arcane', name: 'Arcane Bow', cost: 1000, blurb: 'Purple arrows that warp space.' },
];
export const PACKS = [
  { id: 'medieval', name: 'Medieval Pack', cost: 0, blurb: 'Engraved shield, broadhead bolt.' },
  { id: 'scifi', name: 'Sci-Fi Pack', cost: 500, blurb: 'Data-cube target, plasma bolt.' },
];

export const OUTFITS = [
  { id: 'ranger', name: 'Elven Warden', cost: 0, blurb: 'Green cape, silver pauldrons.', tunic: 0x2f6b3c, cloak: 0x3b8a35, leather: 0x5a3a20, trim: 0xd9b04a, plate: 0xc9d3e0, hair: 0xe0b850, eyes: 0x2fae5a, plates: false, halo: false, aura: 0 },
  { id: 'royal', name: 'Royal Guard', cost: 300, blurb: 'Blue and silver plate.', tunic: 0x2b4f9e, cloak: 0x1b2d63, leather: 0x4a3a2a, trim: 0xe8eef8, plate: 0xd5deea, hair: 0xe0b850, eyes: 0x5fb6ff, plates: true, halo: false, aura: 0 },
  { id: 'shadow', name: 'Shadow Hunter', cost: 600, blurb: 'Night cloak, violet glow.', tunic: 0x262034, cloak: 0x14101f, leather: 0x2a2433, trim: 0xa66bff, plate: 0x4a3f66, hair: 0xcfd4e8, eyes: 0xc07aff, plates: true, halo: false, aura: 0xa66bff },
  { id: 'paladin', name: 'Golden Paladin', cost: 900, blurb: 'Radiant gold, with halo.', tunic: 0xf0ead8, cloak: 0xd8b24a, leather: 0x8a6a2a, trim: 0xffd24a, plate: 0xf2c94a, hair: 0xf2d27a, eyes: 0x7fd6ff, plates: true, halo: true, aura: 0xffe28a },
];

export const ARROW_LENGTH = 0.7;

export function goldify(obj) {
  obj.traverse((m) => {
    if (m.material && m.material.color) {
      m.material = m.material.clone(); m.material.color.set(0xffd24a);
      if (m.material.emissive) { m.material.emissive.set(0xffa010); m.material.emissiveIntensity = 0.8; }
    }
  });
  obj.userData.trail = 0xffd24a;
}

// Visible arrow upgrades: heat tier (from streak), golden arrow, steady-hands aura.
const TIER_COLORS = [null, 0xffb347, 0xff6a1a, 0x9fe8ff];
export function decorateArrow(obj, { tier = 0, gold = false, steady = false } = {}) {
  const L = obj.userData.length || ARROW_LENGTH;
  if (gold) goldify(obj);
  const aura = steady ? 0x6dd5ff : TIER_COLORS[tier];
  if (aura) {
    const r = 0.03 + tier * 0.012, len = L + 0.15 + tier * 0.25;
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.6, len, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: aura, transparent: true, opacity: 0.2 + tier * 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    halo.rotation.x = Math.PI / 2; halo.position.z = -L / 2 + (len - L) / 2;
    halo.scale.set(1 / 1.5, 1 / 1.5, 1); obj.add(halo);
    obj.userData.trail = gold ? 0xffd24a : aura;
  }
  obj.userData.tier = tier;
  return obj;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const add = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

function limbTube(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), material);
}

// Bows are built in a "bow frame": limbs along Y, target is -Z, the archer is at +Z.
// Grip is at the origin; the string rests at z = REST and is pulled toward +z.
export const STRING_REST = 0.12;

export function buildBow(id) {
  const root = new THREE.Group();
  const info = { root, tipTop: new THREE.Vector3(0, 0.5, STRING_REST), tipBot: new THREE.Vector3(0, -0.5, STRING_REST), stringColor: 0xf3efe2, spin: [], steam: null, arrowStyle: null };

  if (id === 'steampunk') {
    info.tipTop.set(0, 0.46, 0.1); info.tipBot.set(0, -0.46, 0.1);
    const brass = std(0xb8893a, { metalness: 0.8, roughness: 0.35 });
    const steel = std(0x5d6670, { metalness: 0.9, roughness: 0.4 });
    root.add(limbTube([[0, 0.46, 0.1], [0, 0.26, -0.03], [0, 0.07, -0.06]], 0.02, brass));
    root.add(limbTube([[0, -0.46, 0.1], [0, -0.26, -0.03], [0, -0.07, -0.06]], 0.02, brass));
    add(root, new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), steel), 0, 0, -0.04);
    for (const [y, r] of [[0.03, 0.05], [-0.05, 0.035]]) {
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 10), brass);
      gear.rotation.z = Math.PI / 2; add(root, gear, 0.04, y, -0.04); info.spin.push(gear);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.03, 8), steel);
      hub.rotation.z = Math.PI / 2; add(root, hub, 0.04, y, -0.04);
    }
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.1, 8), std(0x8a5a2b, { metalness: 0.7 })), 0, 0.14, -0.04);
    for (const s of [1, -1]) add(root, new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), std(0xc66a2c, { metalness: 0.8 })), 0, 0.46 * s, 0.1);
    info.steam = new THREE.Vector3(0, 0.2, -0.04);
    info.stringColor = 0xd8c9a0;
    info.arrowStyle = 'clockwork';
  } else if (id === 'laser') {
    info.tipTop.set(0, 0.44, 0.14); info.tipBot.set(0, -0.44, 0.14);
    const black = std(0x15181f, { metalness: 0.7, roughness: 0.3 });
    const cyan = glow(0x39e6ff);
    for (const s of [1, -1]) {
      root.add(limbTube([[0, 0.44 * s, 0.14], [0, 0.25 * s, 0.0], [0, 0.07 * s, -0.04]], 0.012, black));
      add(root, new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), cyan), 0, 0.28 * s, 0.03).rotation.x = 0.55 * s;
      add(root, new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), cyan), 0, 0.44 * s, 0.14);
    }
    add(root, new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.16), black), 0, 0, -0.03);
    add(root, new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.04, 0.17), cyan), 0, 0.02, -0.03);
    add(root, new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.3), black), 0, -0.07, 0.12);
    info.stringColor = 0x6ff3ff;
    info.arrowStyle = 'beam';
  } else if (id === 'arcane') {
    const purple = std(0x6b2fd0, { emissive: 0x4a1fb0, emissiveIntensity: 0.9, roughness: 0.3 });
    const crystal = glow(0xd7a6ff);
    root.add(limbTube([[0, 0.5, 0.12], [0, 0.3, -0.04], [0, 0.0, -0.09], [0, -0.3, -0.04], [0, -0.5, 0.12]], 0.016, purple));
    for (const s of [1, -1]) add(root, new THREE.Mesh(new THREE.OctahedronGeometry(0.035), crystal), 0, 0.5 * s, 0.12);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 24), crystal);
    add(root, ring, 0, 0, -0.09); info.spin.push(ring);
    add(root, new THREE.Mesh(new THREE.OctahedronGeometry(0.03), crystal), 0, 0, -0.09);
    info.stringColor = 0xc59bff;
    info.arrowStyle = 'arcane';
  } else {
    const wood = std(0x7a5230, { roughness: 0.75 });
    root.add(limbTube([[0, 0.5, 0.12], [0, 0.3, -0.02], [0, 0.0, -0.075], [0, -0.3, -0.02], [0, -0.5, 0.12]], 0.015, wood));
    add(root, new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 10), std(0x2d1d12)), 0, 0, -0.075);
    for (const s of [1, -1]) add(root, new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), std(0xd9b04a, { metalness: 0.8, roughness: 0.3 })), 0, 0.5 * s, 0.12);
    for (const s of [1, -1]) add(root, new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 12), std(0xd9b04a, { metalness: 0.8 })), 0, 0.12 * s, -0.07).rotation.x = Math.PI / 2;
    info.arrowStyle = null; // follows the pack
  }
  return info;
}

// Arrows point toward -Z with their tail at the origin; tip at z = -ARROW_LENGTH.
export function buildArrow(style) {
  const g = new THREE.Group();
  const L = ARROW_LENGTH;
  const shaftMesh = (r, color, len = L, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat || std(color));
    m.rotation.x = Math.PI / 2; m.position.z = -len / 2; return m;
  };
  const cone = (r, h, mat, z) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat); m.rotation.x = -Math.PI / 2; m.position.z = z; return m; };
  g.userData.trail = 0xffffff;

  if (style === 'plasma') {
    g.add(shaftMesh(0.012, 0, L, glow(0x5ff3ff)));
    g.add(shaftMesh(0.006, 0, L, glow(0xffffff)));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), glow(0xaafaff));
    orb.position.z = -L; g.add(orb);
    g.userData.trail = 0x5ff3ff;
  } else if (style === 'clockwork') {
    const brass = std(0xb8893a, { metalness: 0.8, roughness: 0.35 });
    g.add(shaftMesh(0.012, 0, L, brass));
    for (const z of [-0.2, -0.38]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 10), brass); r.position.z = z; g.add(r); }
    g.add(cone(0.026, 0.1, std(0xc23b22, { metalness: 0.6 }), -L - 0.04));
    g.userData.trail = 0xe8e8e8;
  } else if (style === 'beam') {
    const len = 1.4;
    const core = shaftMesh(0.008, 0, len, glow(0xffffff)); core.position.z = -len / 2 + 0.1;
    const halo = shaftMesh(0.03, 0, len, glow(0x39e6ff, { transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.z = -len / 2 + 0.1;
    g.add(core, halo);
    g.userData.trail = 0x39e6ff; g.userData.length = len - 0.1;
  } else if (style === 'arcane') {
    g.add(shaftMesh(0.012, 0, L, std(0x7a3cff, { emissive: 0x8a4cff, emissiveIntensity: 1.2 })));
    g.add(shaftMesh(0.035, 0, L, glow(0xb98aff, { transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), glow(0xe2c4ff));
    orb.position.z = -L; g.add(orb);
    g.userData.trail = 0xb98aff;
  } else { // broadhead (medieval default)
    g.add(shaftMesh(0.007, 0x8c6a3f, L));
    const head = cone(0.03, 0.1, std(0x8a929a, { metalness: 0.9, roughness: 0.3 }), -L - 0.03);
    head.scale.set(1, 1, 0.35); head.rotation.z = 0; g.add(head);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.12), std(i === 0 ? 0xc43b3b : 0x3f8f4a));
      f.position.z = -0.07; f.rotation.z = (i * Math.PI * 2) / 3; f.position.x = Math.sin(f.rotation.z) * -0.0; g.add(f);
    }
    g.userData.trail = 0xfff2c4;
  }
  g.userData.length = g.userData.length || L;
  g.scale.set(1.5, 1.5, 1); // chunkier arrows read much better in VR
  return g;
}

// The overdrive ballista bolt: huge, glowing, guaranteed fit.
export function buildOverdriveBolt() {
  const g = new THREE.Group();
  const gold = glow(0xffc23a);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10), gold);
  core.rotation.x = Math.PI / 2; core.position.z = -0.65; g.add(core);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 12), glow(0xffffff));
  tip.rotation.x = -Math.PI / 2; tip.position.z = -1.4; g.add(tip);
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 12, 1, true), glow(0xff8a1f, { transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  halo.rotation.x = Math.PI / 2; halo.position.z = -0.75; g.add(halo);
  g.userData.trail = 0xffb43a; g.userData.length = 1.5;
  return g;
}
