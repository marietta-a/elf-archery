import * as THREE from 'three';
import { buildBow, buildArrow, buildOverdriveBolt, decorateArrow, STRING_REST } from './weapons.js';

// A procedural, kneeling elven archer rebuilt from the player's reference views (front / side / back):
// long golden hair with two front braids, silver circlet with an emerald, tall pointed ears, layered silver
// pauldrons, green bodice over a brown corset, green cape, leather bracers and thigh-high boots with silver
// knee guards. Built from simple primitives (an approximation, not a copy of the art).
// Model frame: faces +Z, her LEFT side is +X. The group is rotated so the bow arm points down the lane (world -Z).

const GRIP = new THREE.Vector3(0.52, 0.72, 0); // bow hand, elf-local
const L_SHOULDER = new THREE.Vector3(0.14, 0.62, 0);
const R_SHOULDER = new THREE.Vector3(-0.14, 0.62, 0);
const ARM_UP = 0.28, ARM_LOW = 0.28;
const DRAW_LEN = 0.4;

const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...o });
const SKIN = m(0xf0c3a2, { roughness: 0.7 }), SKIN_D = m(0xdfa886, { roughness: 0.7 });
const HAIR = m(0xe0b850, { roughness: 0.55 }), HAIR_L = m(0xf2d27a, { roughness: 0.55 }), HAIR_D = m(0xb88a30, { roughness: 0.6 });
const TUNIC = m(0x2f6b3c), CLOAK = m(0x3b8a35, { side: THREE.DoubleSide }), LEATHER = m(0x5a3a20), LEATHER_D = m(0x3a2414), DARK = m(0x2d1d12);
// no environment map in the scene, so keep metalness low or metals render black
const GOLD = m(0xd9b04a, { metalness: 0.25, roughness: 0.4, emissive: 0x2a1e00, emissiveIntensity: 0.4 }), PLATE = m(0xc9d3e0, { metalness: 0.3, roughness: 0.4, emissive: 0x20262e, emissiveIntensity: 0.5 });
const EMERALD = new THREE.MeshStandardMaterial({ color: 0x22e08a, emissive: 0x0f9a5a, emissiveIntensity: 0.9, roughness: 0.2 });
const LIPS = m(0xc96a64, { roughness: 0.5 });
const EYE_W = m(0xf4f1e6, { roughness: 0.4 }), EYE_G = new THREE.MeshBasicMaterial({ color: 0x2fae5a }), BLACK = new THREE.MeshBasicMaterial({ color: 0x120c08 });

function seg(mesh, a, b) { // stretch a unit-height cylinder between two points
  const d = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(1e-4, d.length());
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(len));
  mesh.scale.y = len;
}
const limb = (r, mat, parent) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), mat);
  parent.add(mesh); return mesh;
};
const ball = (r, mat, parent, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
};
const shape = (geo, mat, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
  const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
};

function solveArm(S, target, pole, out) { // two-bone IK; returns clamped hand, writes elbow into `out`
  const d = new THREE.Vector3().subVectors(target, S);
  let dist = d.length();
  const maxD = (ARM_UP + ARM_LOW) * 0.995;
  const hand = target.clone();
  if (dist > maxD) { d.multiplyScalar(maxD / dist); dist = maxD; hand.copy(S).add(d); }
  const dir = d.clone().normalize();
  const a = (ARM_UP * ARM_UP - ARM_LOW * ARM_LOW + dist * dist) / (2 * Math.max(dist, 1e-3));
  const h = Math.sqrt(Math.max(0, ARM_UP * ARM_UP - a * a));
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-6) perp.set(0, 1, 0);
  perp.normalize();
  out.copy(S).addScaledVector(dir, a).addScaledVector(perp, h);
  return hand;
}

export function createElf() {
  const group = new THREE.Group();
  const body = new THREE.Group(); // everything that rotates with the elf
  group.add(body);

  // --- torso: brown corset, green bodice, silver emblem, belt, tabard, jagged leather skirt
  const corset = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.102, 0.2, 14), LEATHER); corset.position.set(0, 0.4, 0); body.add(corset);
  const torso = ball(0.118, TUNIC, body, 0, 0.56, 0); torso.scale.set(1, 0.95, 0.95);
  shape(new THREE.OctahedronGeometry(0.05), PLATE, body, 0, 0.55, 0.108, 1, 1.35, 0.35);
  shape(new THREE.OctahedronGeometry(0.022), EMERALD, body, 0, 0.55, 0.12, 1, 1.3, 0.6);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.02, 8, 20), LEATHER); belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.31, 0); body.add(belt);
  shape(new THREE.OctahedronGeometry(0.04), PLATE, body, 0, 0.31, 0.12, 1, 1.2, 0.3);
  shape(new THREE.BoxGeometry(0.12, 0.2, 0.012), TUNIC, body, 0, 0.19, 0.185);
  shape(new THREE.BoxGeometry(0.012, 0.16, 0.016), GOLD, body, 0, 0.19, 0.19);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.2, 0.16, 8), LEATHER_D); skirt.position.set(0, 0.25, 0); body.add(skirt);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const tooth = shape(new THREE.ConeGeometry(0.036, 0.075, 5), LEATHER, body, Math.sin(a) * 0.195, 0.145, Math.cos(a) * 0.195);
    tooth.rotation.x = Math.PI;
  }
  // green cape, hood at the neck
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.31, 0.76, 22, 1, true, Math.PI - 1.4, 2.8), CLOAK);
  cloak.position.set(0, 0.36, -0.01); body.add(cloak);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), CLOAK); hood.position.set(0, 0.66, -0.1); hood.rotation.x = Math.PI + 0.5; body.add(hood);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 18), CLOAK); collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.68, -0.025); body.add(collar);
  shape(new THREE.OctahedronGeometry(0.03), EMERALD, body, 0, 0.67, 0.1, 1, 1.4, 0.5); // clasp
  // quiver
  const quiver = new THREE.Group(); quiver.position.set(0.0, 0.54, -0.2); quiver.rotation.set(-0.35, 0, 0.1); body.add(quiver);
  quiver.add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 10), LEATHER));
  [[-0.015, 0xe9e2cf], [0.015, 0xe9e2cf], [0, 0x3f8f4a]].forEach(([x, c], i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 6), m(c)); f.position.set(x, 0.24 + i * 0.012, (i - 1) * 0.015); quiver.add(f);
  });
  // layered silver pauldrons with a spike, like the reference
  for (const sx of [1, -1]) {
    const pg = new THREE.Group(); pg.position.set(0.15 * sx, 0.685, 0); body.add(pg);
    shape(new THREE.SphereGeometry(0.1, 14, 8), PLATE, pg, 0, 0, 0, 1, 0.55, 1.2);
    shape(new THREE.SphereGeometry(0.085, 14, 8), PLATE, pg, 0.035 * sx, -0.04, 0, 1, 0.5, 1.15);
    shape(new THREE.SphereGeometry(0.07, 12, 8), PLATE, pg, 0.065 * sx, -0.08, 0, 1, 0.45, 1.1);
    const spike = shape(new THREE.ConeGeometry(0.03, 0.12, 6), PLATE, pg, 0.03 * sx, 0.06, 0); spike.rotation.z = -sx * 0.5;
    const trim = shape(new THREE.TorusGeometry(0.095, 0.008, 6, 16), GOLD, pg, 0, -0.005, 0); trim.rotation.x = Math.PI / 2; trim.scale.set(1, 1.2, 1);
  }

  // --- legs: she STANDS normally and only kneels (right knee down, left foot planted) while aiming.
  // The whole body is lifted by LIFT when standing; legs are re-posed each frame from standing -> kneeling.
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const LIFT = 0.5; // taller when standing: natural leg length
  const legSpecs = [
    { hip: V3(0.09, 0.3, 0), kneel: { knee: V3(0.3, 0.42, 0.03), foot: V3(0.34, 0.07, 0.03), kg: V3(0.05, 0.03, 0) }, stand: { knee: V3(0.095, -0.07, 0.05), foot: V3(0.1, -0.43, 0.02), kg: V3(0, 0, 0.065) } },
    { hip: V3(-0.09, 0.3, 0), kneel: { knee: V3(-0.2, 0.07, 0.02), foot: V3(-0.4, 0.08, 0.03), kg: V3(0, 0.06, 0) }, stand: { knee: V3(-0.095, -0.07, 0.05), foot: V3(-0.1, -0.43, 0.02), kg: V3(0, 0, 0.065) } },
  ];
  const legRigs = legSpecs.map((sp) => ({
    sp,
    thighSkin: limb(0.058, SKIN, body), thighBoot: limb(0.07, LEATHER, body), shin: limb(0.06, LEATHER, body),
    kneeBall: ball(0.07, LEATHER, body),
    cuff: shape(new THREE.TorusGeometry(0.068, 0.01, 6, 14), GOLD, body, 0, 0, 0),
    guard: shape(new THREE.OctahedronGeometry(0.075), PLATE, body, 0, 0, 0, 1.1, 1.5, 0.8),
    boot: ball(0.068, LEATHER_D, body), 
  }));
  legRigs.forEach((r) => r.boot.scale.set(1.35, 0.7, 0.95));
  const tmpK = V3(0, 0, 0), tmpF = V3(0, 0, 0), tmpG = V3(0, 0, 0);
  function poseLegs(k) {
    for (const r of legRigs) {
      const { hip, kneel, stand } = r.sp;
      tmpK.lerpVectors(stand.knee, kneel.knee, k); tmpF.lerpVectors(stand.foot, kneel.foot, k); tmpG.lerpVectors(stand.kg, kneel.kg, k);
      seg(r.thighSkin, hip, hip.clone().lerp(tmpK, 0.5));
      seg(r.thighBoot, hip.clone().lerp(tmpK, 0.4), tmpK);
      seg(r.shin, tmpK, tmpF);
      r.kneeBall.position.copy(tmpK);
      r.cuff.position.copy(hip).lerp(tmpK, 0.4); r.cuff.quaternion.setFromUnitVectors(V3(0, 0, 1), tmpK.clone().sub(hip).normalize());
      r.guard.position.copy(tmpK).add(tmpG);
      r.boot.position.set(tmpF.x + 0.03 * k, tmpF.y - 0.01, tmpF.z + 0.045 * (1 - k)); r.boot.rotation.y = (Math.PI / 2) * (1 - k);
    }
  }
  poseLegs(0);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; group.add(shadow);

  // --- head
  const head = new THREE.Group(); head.position.set(0, 0.93, -0.09); head.scale.setScalar(1.14); body.add(head);
  const neck = limb(0.042, SKIN_D, body); seg(neck, new THREE.Vector3(0, 0.64, 0), new THREE.Vector3(0, 0.8, -0.07));
  const skull = ball(0.13, SKIN, head); skull.scale.set(0.92, 1.1, 1);
  const jaw = ball(0.085, SKIN, head, 0, -0.065, 0.03); jaw.scale.set(0.9, 0.85, 0.95);
  const chin = ball(0.035, SKIN, head, 0, -0.115, 0.06); chin.scale.set(0.9, 0.8, 0.8);
  // golden hair: crown cap, side locks, long fall down the back, two front braids
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.142, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), HAIR_L);
  cap.position.set(0, 0.012, -0.014); cap.rotation.x = -0.12; head.add(cap);
  for (const sx of [1, -1]) { const side = ball(0.06, HAIR, head, 0.1 * sx, -0.01, -0.03); side.scale.set(0.7, 1.5, 1.0); }
  const braid = new THREE.Group(); braid.position.set(0, 0.0, -0.1); head.add(braid); // back hair (sways)
  for (let i = 0; i < 4; i++) { const b = ball(0.105 - i * 0.012, i % 2 ? HAIR : HAIR_L, braid, 0, -0.06 - i * 0.065, -0.03 - i * 0.01); b.scale.set(1.1, 1.1, 0.62); } // shoulder-length
  for (const sx of [1, -1]) {
    for (let i = 0; i < 3; i++) { const b = ball(0.027 - i * 0.003, i % 2 ? HAIR_D : HAIR, head, 0.115 * sx, -0.07 - i * 0.06, 0.075 - i * 0.004); b.scale.set(1, 1.3, 1); }
  }
  // face
  const eyes = [];
  for (const s of [1, -1]) {
    const eg = new THREE.Group(); eg.position.set(0.05 * s, 0.005, 0.117); head.add(eg);
    const w = ball(0.026, EYE_W, eg); w.scale.set(1, 0.7, 0.45);
    const ir = ball(0.018, EYE_G, eg, 0, 0, 0.008); ir.scale.set(1, 0.95, 0.4);
    ball(0.008, BLACK, eg, 0, 0, 0.013);
    shape(new THREE.BoxGeometry(0.058, 0.007, 0.012), DARK, eg, 0, 0.02, 0.006); // upper lash line
    eyes.push(eg);
  }
  const brows = [];
  for (const s of [1, -1]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.01), HAIR_D);
    br.position.set(0.05 * s, 0.048, 0.122); head.add(br); br.userData.side = s; brows.push(br);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.04, 6), SKIN_D);
  nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.018, 0.135); head.add(nose);
  const mouths = {
    flat: new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.008, 0.008), LIPS),
    smile: new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 12, Math.PI), LIPS),
    frown: new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 12, Math.PI), LIPS),
    open: new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), LIPS),
  };
  mouths.smile.rotation.z = Math.PI; mouths.smile.position.set(0, -0.058, 0.118);
  mouths.frown.position.set(0, -0.085, 0.115);
  mouths.flat.position.set(0, -0.07, 0.118);
  mouths.open.position.set(0, -0.072, 0.118); mouths.open.scale.set(1.3, 1, 0.5);
  Object.values(mouths).forEach((x) => { x.visible = false; head.add(x); });
  // tall pointed elf ears
  const ears = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(0.122 * s, 0.0, -0.01); pivot.rotation.y = 0.6 * s; head.add(pivot);
    const g = new THREE.ConeGeometry(0.04, 0.3, 8); g.translate(0, 0.15, 0);
    const ear = new THREE.Mesh(g, SKIN); ear.rotation.z = -s * (Math.PI / 2 - 0.28); ear.scale.z = 0.42; pivot.add(ear);
    const inner = new THREE.Mesh(g.clone(), SKIN_D); inner.scale.set(0.5, 0.78, 0.5); inner.position.z = 0.004; ear.add(inner);
    ears.push({ pivot, ear, base: ear.rotation.z, s });
  }
  // silver circlet with an emerald
  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.134, 0.006, 6, 28), PLATE); circlet.rotation.x = Math.PI / 2 - 0.1; circlet.position.set(0, 0.06, 0); head.add(circlet);
  shape(new THREE.OctahedronGeometry(0.02), EMERALD, head, 0, 0.062, 0.138, 0.9, 1.4, 0.7);
  shape(new THREE.OctahedronGeometry(0.01), PLATE, head, 0, 0.098, 0.13, 0.8, 1.4, 0.6);

  // --- arms: bare upper arm, leather bracer with silver plate, fingerless glove
  const arms = [L_SHOULDER, R_SHOULDER].map((S) => {
    const up = limb(0.045, SKIN, body), low = limb(0.045, LEATHER, body);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.07), PLATE); body.add(plate);
    const hand = ball(0.05, LEATHER_D, body); ball(0.062, LEATHER_D, body, S.x, S.y + 0.01, S.z);
    return { S, up, low, plate, hand, elbow: new THREE.Vector3(), joint: ball(0.045, SKIN, body) };
  });

  const proc = body.children.slice(); // the procedural character, hidden when a real .glb model is loaded

  // --- outfit extras (toggled by outfit): cuirass over the bodice + waist plate; halo; power aura
  const plates = new THREE.Group(); body.add(plates);
  const cuirass = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), PLATE); cuirass.scale.set(1.12, 1.3, 1.05); cuirass.position.set(0, 0.5, 0); plates.add(cuirass);
  const waist = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20), PLATE); waist.rotation.x = Math.PI / 2; waist.position.set(0, 0.34, 0); plates.add(waist);
  plates.visible = false;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.rotation.x = Math.PI / 2; halo.position.set(0, 1.27, -0.09); halo.visible = false; body.add(halo);
  const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  aura.position.set(0, 0.62, -0.05); aura.scale.setScalar(1.7); aura.visible = false; body.add(aura);

  // --- bow (follows the left hand)
  const bowPivot = new THREE.Group(); body.add(bowPivot);
  const bowFrame = new THREE.Group(); bowFrame.rotation.y = -Math.PI / 2; bowPivot.add(bowFrame);
  const stringTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const stringBot = stringTop.clone();
  let bow = null, nockedArrow = null;
  const arrowSlot = new THREE.Group(); bowFrame.add(arrowSlot);
  bowFrame.add(stringTop, stringBot);

  let model = null, mixer = null, card = null, cardMats = [];
  const CARD_HEIGHT = 1.3, CARD_OFF = { x: 0.3, z: -0.85 }; // flat paper-doll cards: size, and offset from the elf origin in world axes
  const OUTFIT_TINT = { ranger: 0xffffff, royal: 0xa8c4ff, shadow: 0x9a8cc0, paladin: 0xffe9b0 };
  const MODEL_HEIGHT = 1.15; // seated-friendly: head stays below the player's eye line so the lane stays visible
  const state = { kneel: 0, holdT: 0, draw: 0, drawTarget: 0, loaded: true, kick: 99, turn: 0, turnTarget: 0, mood: 'focus', moodT: 0, blink: 3, twitch: 2, drawing: false, bowId: 'elven', arrowStyle: 'broadhead', overdrive: false, look: { tier: 0, gold: false, steady: false, triple: false }, perkAura: 0, outfitAura: 0 };

  function rebuildBow() {
    if (bow) bowFrame.remove(bow.root);
    bow = buildBow(state.bowId);
    bowFrame.add(bow.root);
    stringTop.material.color.set(bow.stringColor);
    stringBot.material.color.set(bow.stringColor);
    rebuildArrow();
  }
  function rebuildArrow() {
    if (nockedArrow) arrowSlot.remove(nockedArrow);
    const style = (bow && bow.arrowStyle) || state.arrowStyle;
    nockedArrow = new THREE.Group();
    if (state.overdrive) { const b = buildOverdriveBolt(); b.scale.setScalar(0.7); nockedArrow.add(b); }
    else for (const dx of state.look.triple ? [-0.07, 0, 0.07] : [0]) { const a = decorateArrow(buildArrow(style), state.look); a.position.x = dx; nockedArrow.add(a); }
    arrowSlot.add(nockedArrow);
  }

  function setMood(mood, secs = 1.2) { state.mood = mood; state.moodT = secs; if (mood !== 'focus') state.holdT = 0; }
  const MOODS = {
    focus: { brow: 0.3, mouth: 'flat', turn: 0 },
    happy: { brow: -0.12, mouth: 'smile', turn: 1 },
    cheer: { brow: -0.2, mouth: 'open', turn: 1 },
    sad: { brow: -0.35, mouth: 'frown', turn: 1 },
    grit: { brow: 0.45, mouth: 'flat', turn: 0 },
  };

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function update(dt, t) {
    if (state.moodT > 0) { state.moodT -= dt; if (state.moodT <= 0 && !state.drawing) state.mood = 'focus'; }
    const mood = MOODS[state.drawing ? 'grit' : state.mood];
    state.turnTarget = state.drawing ? 0 : mood.turn;
    state.turn += (state.turnTarget - state.turn) * Math.min(1, dt * (state.drawing ? 14 : 6));
    state.draw += (state.drawTarget - state.draw) * Math.min(1, dt * 18);
    state.kick += dt;
    if (mixer) mixer.update(dt);
    const turn = state.turn;
    const mix = turn * turn * (3 - 2 * turn);

    // stand <-> kneel: kneel only while drawing (plus a short follow-through); stand at the side of the lane otherwise
    const external = !!(card || model);
    state.holdT = Math.max(0, state.holdT - dt);
    const kTarget = state.drawing || state.holdT > 0 ? 1 : 0;
    state.kneel += (kTarget - state.kneel) * Math.min(1, dt * (kTarget ? 14 : 6));
    const kr = external ? 1 : state.kneel;
    const k = kr * kr * (3 - 2 * kr);
    const STAND_X = 0.95, STAND_Z = -0.35; // she waits out to the right (and a bit back) so the lane and target stay clear, then steps in to aim
    if (state.baseZ === undefined) state.baseZ = group.position.z;
    group.position.x = external ? 0 : THREE.MathUtils.lerp(STAND_X, 0, k);
    group.position.z = external ? state.baseZ : state.baseZ + THREE.MathUtils.lerp(STAND_Z, 0, k);
    const yawBase = external ? Math.PI / 2 : THREE.MathUtils.lerp(Math.PI, Math.PI / 2, k);
    group.rotation.y = THREE.MathUtils.lerp(yawBase, 0.2, mix);
    if (!external) poseLegs(k);
    if (card) { // paper-doll: her back faces the player while aiming; she flips to show her front when she reacts
      const R = group.rotation.y;
      card.rotation.y = Math.PI * (1 - mix) - R;
      card.position.set(CARD_OFF.x * Math.cos(R) - CARD_OFF.z * Math.sin(R), 0, CARD_OFF.x * Math.sin(R) + CARD_OFF.z * Math.cos(R));
      aura.position.set(card.position.x, 0.7, card.position.z);
      halo.position.set(card.position.x, CARD_HEIGHT + 0.05, card.position.z);
    }
    head.rotation.y = THREE.MathUtils.lerp(0, Math.PI / 2 * 0.92, external ? 1 : k) * (1 - mix);
    head.rotation.x = (state.mood === 'sad' && !state.drawing ? 0.35 : 0) * mix + Math.sin(t * 1.3) * 0.01;
    body.position.y = Math.sin(t * 1.9) * 0.004 + (external ? 0 : LIFT * (1 - k));
    braid.rotation.x = 0.25 + Math.sin(t * 1.7) * 0.05 + state.draw * 0.1;
    torso.scale.set(1, 1 + Math.sin(t * 1.9) * 0.015, 1);

    // string + nock
    const vib = state.kick < 0.6 ? Math.sin(state.kick * 70) * Math.exp(-state.kick * 11) * 0.05 : 0;
    const pull = STRING_REST + DRAW_LEN * state.draw + (state.loaded ? 0 : -0.0) - vib * (state.loaded ? 0 : 1);
    const nock = tmpA.set(0, 0, pull);
    seg(stringTop, bow.tipTop, nock);
    seg(stringBot, bow.tipBot, nock);
    arrowSlot.position.copy(nock);
    nockedArrow.visible = state.loaded && (external || k > 0.5);
    bow.spin.forEach((s, i) => { s.rotation.x += dt * (i ? -1.5 : 1); });

    // hand targets
    const leftAim = GRIP.clone(); leftAim.y += Math.sin(t * 1.4) * 0.003;
    const rightAim = new THREE.Vector3(GRIP.x - pull, GRIP.y, 0);
    const sad = state.mood === 'sad';
    const sway = Math.sin(t * 1.6) * 0.012;
    const leftRelax = V3(0.19, 0.17 + sway, 0.04), rightRelax = V3(-0.19, 0.17 - sway, 0.04); // arms resting at her sides
    leftAim.lerpVectors(leftRelax, leftAim, k); rightAim.lerpVectors(rightRelax, rightAim, k);
    const leftAlt = sad ? V3(0.2, 0.3, 0.1) : V3(0.27, 0.78 + Math.sin(t * 9) * 0.03 * (state.mood === 'cheer' ? 1 : 0), 0.17);
    const rightAlt = sad ? V3(0.0, 0.86, 0.17) : V3(-0.27, 0.78 + Math.cos(t * 9) * 0.03 * (state.mood === 'cheer' ? 1 : 0), 0.17);
    const targets = [leftAim.lerp(leftAlt, mix), rightAim.lerp(rightAlt, mix)];
    const poles = [
      new THREE.Vector3(0, -1, -0.3),
      new THREE.Vector3(0, 1, -0.3).lerp(new THREE.Vector3(-1, -0.2, -0.2), mix),
    ];
    arms.forEach((a, i) => {
      const hand = solveArm(a.S, targets[i], poles[i], a.elbow);
      seg(a.up, a.S, a.elbow); seg(a.low, a.elbow, hand);
      a.plate.position.lerpVectors(a.elbow, hand, 0.5); a.plate.quaternion.copy(a.low.quaternion);
      a.hand.position.copy(hand); a.joint.position.copy(a.elbow);
      if (i === 0) {
        bowPivot.position.copy(card ? GRIP : hand); // paper-doll: the bow stays on the lane instead of following hidden hands
        bowPivot.rotation.z = card ? 0 : mix * (sad ? -0.9 : 0.7);
        bowPivot.rotation.y = external ? 0 : -(Math.PI / 2) * (1 - k); // carried pointing forward at her side, swung into the lane to aim
      }
    });

    // power aura + paladin halo
    const auraCol = state.perkAura || state.outfitAura;
    aura.visible = !!auraCol;
    if (auraCol) { aura.material.color.setHex(auraCol); aura.material.opacity = (state.perkAura ? 0.5 : 0.28) + Math.sin(t * 3.2) * 0.1; aura.scale.setScalar(1.7 + Math.sin(t * 2.4) * 0.12); }
    if (halo.visible) { if (!card) halo.position.y = 1.27 + Math.sin(t * 2) * 0.012; else halo.position.y = CARD_HEIGHT + 0.05 + Math.sin(t * 2) * 0.012; halo.rotation.z += dt * 0.8; }

    // face
    for (const b of brows) b.rotation.z = b.userData.side * mood.brow;
    for (const k in mouths) mouths[k].visible = k === mood.mouth;
    state.blink -= dt;
    const bl = state.blink < 0.12 && state.blink > 0 ? 0.1 : 1;
    if (state.blink < 0) state.blink = 2.5 + Math.random() * 3;
    eyes.forEach((e) => { e.scale.y = bl; });
    state.twitch -= dt;
    ears.forEach((e) => {
      const tw = state.twitch < 0.25 && state.twitch > 0 && e.s === 1 ? Math.sin(state.twitch * 50) * 0.18 : 0;
      e.ear.rotation.z = e.base + e.s * (tw + (state.drawing ? -0.08 : 0) + (state.mood === 'sad' && mix > 0.5 ? 0.35 : 0));
    });
    if (state.twitch < 0) state.twitch = 3 + Math.random() * 4;
  }

  rebuildBow();
  return {
    group,
    update,
    setDrawing(on) { state.drawing = on; if (!on) state.drawTarget = 0; },
    setDraw(p) { state.drawTarget = p; },
    getDraw: () => state.draw,
    setLoaded(b) { state.loaded = b; },
    release() { state.holdT = 0.55; state.drawTarget = 0; state.draw = Math.min(state.draw, 0.35); state.kick = 0; state.loaded = false; state.drawing = false; },
    react(mood, secs) { setMood(mood, secs); },
    setBow(id) { state.bowId = id; rebuildBow(); },
    setArrowStyle(style) { state.arrowStyle = style; rebuildArrow(); },
    arrowStyle: () => (bow && bow.arrowStyle) || state.arrowStyle,
    bowInfo: () => bow,
    setOutfit(o) {
      TUNIC.color.setHex(o.tunic); CLOAK.color.setHex(o.cloak); LEATHER.color.setHex(o.leather); LEATHER_D.color.setHex(o.leather).multiplyScalar(0.62); GOLD.color.setHex(o.trim);
      PLATE.color.setHex(o.plate); EYE_G.color.setHex(o.eyes);
      HAIR.color.setHex(o.hair); HAIR_L.color.setHex(o.hair).lerp(new THREE.Color(0xffffff), 0.28); HAIR_D.color.setHex(o.hair).multiplyScalar(0.7);
      state.outfitId = o.id; cardMats.forEach((mat) => mat.color.setHex(OUTFIT_TINT[o.id] || 0xffffff));
      plates.visible = o.plates && !model; halo.visible = o.halo; state.outfitAura = o.aura;
    },
    // Swap the procedural character for a real model (e.g. glTF/GLB made from the reference art).
    // The model is auto-scaled to MODEL_HEIGHT, stood on the plinth and turned to face the lane; if it
    // has animation clips an idle/stand clip loops. The bow, string, arrows, aura and halo stay as they are.
    useModel(obj, clips = []) {
      proc.forEach((c) => { c.visible = false; });
      plates.visible = false;
      if (model) body.remove(model);
      card = null; cardMats = [];
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      if (size.z < size.y * 0.15) { // image cards (front / back art on thin slabs): keep the painting as painted
        const meshes = []; obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
        for (const mesh of meshes) {
          const map = mesh.material.map; if (map) map.anisotropy = 8;
          const uv = mesh.geometry.attributes.uv && mesh.geometry.attributes.uv.clone(); if (uv) mesh.geometry.setAttribute('uv', uv); // (the loader shares one UV buffer between both slabs, so clone before editing)
          // the cards were exported with OpenGL-style V (bottom-up); glTF is top-down, so the art loads upside down: flip V
          if (uv) { for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); uv.needsUpdate = true; }
          mesh.material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.FrontSide }); cardMats.push(mesh.material);
        }
        const img = meshes[0] && meshes[0].material.map && meshes[0].material.map.image;
        const aspect = img && img.width ? img.width / img.height : size.x / size.y; // fix squashed card geometry using the texture's real aspect
        obj.scale.set((CARD_HEIGHT * aspect) / size.x, CARD_HEIGHT / size.y, 1);
        box.setFromObject(obj);
        const cc = box.getCenter(new THREE.Vector3());
        obj.position.set(-cc.x, -box.min.y, -cc.z);
        const holder = new THREE.Group(); holder.add(obj);
        body.add(holder); model = holder; card = holder; mixer = null;
        cardMats.forEach((mat) => mat.color.setHex(OUTFIT_TINT[state.outfitId] || 0xffffff));
        return;
      }
      obj.scale.multiplyScalar(MODEL_HEIGHT / Math.max(size.y, 1e-3));
      box.setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      obj.position.set(-c.x, -box.min.y, -c.z);
      const holder = new THREE.Group(); holder.add(obj);
      holder.rotation.y = Math.PI / 2; holder.position.set(-0.05, 0, 0.17);
      body.add(holder); model = holder;
      mixer = null;
      if (clips.length) { mixer = new THREE.AnimationMixer(obj); mixer.clipAction(clips.find((k) => /idle|stand/i.test(k.name)) || clips[0]).play(); }
    },
    // Cutout fallback: front/back art (transparent PNG/WebP textures) as a two-sided paper-doll card.
    useCard(frontTex, backTex) {
      proc.forEach((c) => { c.visible = false; });
      plates.visible = false;
      if (model) body.remove(model);
      mixer = null; cardMats = [];
      const img = frontTex.image;
      const W = CARD_HEIGHT * (img && img.width ? img.width / img.height : 0.667);
      const holder = new THREE.Group();
      for (const [tex, z, ry] of [[frontTex, 0.01, 0], [backTex, -0.01, Math.PI]]) {
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.FrontSide }); cardMats.push(mat);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(W, CARD_HEIGHT), mat); p.position.set(0, CARD_HEIGHT / 2, z); p.rotation.y = ry; holder.add(p);
      }
      cardMats.forEach((mat) => mat.color.setHex(OUTFIT_TINT[state.outfitId] || 0xffffff));
      body.add(holder); model = holder; card = holder;
    },
    hasModel: () => !!model,
    setAura(hex) { state.perkAura = hex || 0; },
    setArrowLook(look) {
      const k = JSON.stringify(look);
      if (k === state.lookKey) return;
      state.lookKey = k; state.look = look; rebuildArrow();
    },
    setOverdrive(on) { if (state.overdrive !== on) { state.overdrive = on; rebuildArrow(); } },
    // distance of the nock in front of the elf's centre along the shooting lane (metres)
    nockForward: () => GRIP.x - (STRING_REST + DRAW_LEN * state.draw),
    bowLocalToWorld(v) { return bowFrame.localToWorld(v); },
  };
}
