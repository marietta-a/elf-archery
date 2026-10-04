import * as THREE from 'three';
import { buildBow, buildArrow, buildOverdriveBolt, decorateArrow, STRING_REST } from './weapons.js';

// A procedural, kneeling half-elf ranger: gruff, hooded-cloak, long-eared archer.
// Inspired by the stoic half-elf archer archetype (e.g. Meneldor from "The Faraway Paladin"),
// but built from original primitives. Model frame: faces +Z, his LEFT side is +X.
// The group is rotated so his bow arm points down the shooting lane (world -Z).

const GRIP = new THREE.Vector3(0.52, 0.72, 0); // bow hand, elf-local
const L_SHOULDER = new THREE.Vector3(0.14, 0.62, 0);
const R_SHOULDER = new THREE.Vector3(-0.14, 0.62, 0);
const ARM_UP = 0.28, ARM_LOW = 0.28;
const DRAW_LEN = 0.4;

const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...o });
const SKIN = m(0xd7a07a), SKIN_D = m(0xc78f68);
const HAIR = m(0xcfc8b4, { roughness: 0.8 }), HAIR_L = m(0xece6d4, { roughness: 0.8 }), BROW = m(0x6b5a44);
const TUNIC = m(0x3f6b3a), CLOAK = m(0x2a4530, { side: THREE.DoubleSide }), LEATHER = m(0x6b4a2b), DARK = m(0x2d1d12);
const PANTS = m(0x4a3c30), GOLD = m(0xd9b04a, { metalness: 0.8, roughness: 0.3 });
const PLATE = m(0xc9d3e0, { metalness: 0.85, roughness: 0.3 });
const EYE_W = m(0xf4f1e6, { roughness: 0.4 }), EYE_G = new THREE.MeshBasicMaterial({ color: 0x4fae5c }), BLACK = new THREE.MeshBasicMaterial({ color: 0x120c08 });

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

  // --- torso, belt, cloak, quiver
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.2, 6, 14), TUNIC);
  torso.position.set(0, 0.47, 0); body.add(torso);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.21, 0.22, 16), TUNIC); skirt.position.set(0, 0.27, 0); body.add(skirt);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.012, 6, 24), GOLD); hem.rotation.x = Math.PI / 2; hem.position.set(0, 0.165, 0); body.add(hem);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.02, 8, 20), LEATHER);
  belt.rotation.x = Math.PI / 2; belt.position.set(0, 0.36, 0); body.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.012), GOLD); buckle.position.set(0, 0.36, 0.14); body.add(buckle);
  const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 0.72, 20, 1, true, Math.PI - 1.35, 2.7), CLOAK);
  cloak.position.set(0, 0.36, -0.01); body.add(cloak);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), CLOAK); hood.position.set(0, 0.66, -0.1); hood.rotation.x = Math.PI + 0.5; body.add(hood);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 18), CLOAK);
  collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.68, -0.025); body.add(collar);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.012), LEATHER);
  strap.position.set(0, 0.5, 0.1); strap.rotation.z = 0.5; body.add(strap);
  const quiver = new THREE.Group(); quiver.position.set(0.0, 0.54, -0.2); quiver.rotation.set(-0.35, 0, 0.1); body.add(quiver);
  const qBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.38, 10), LEATHER); quiver.add(qBody);
  [[-0.015, 0xc43b3b], [0.015, 0xe9e2cf], [0, 0x3f8f4a]].forEach(([x, c], i) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 6), m(c)); f.position.set(x, 0.24 + i * 0.012, (i - 1) * 0.015); quiver.add(f);
  });

  // --- legs (kneeling: right knee down, left foot planted)
  const legs = [
    [new THREE.Vector3(0.09, 0.3, 0), new THREE.Vector3(0.3, 0.42, 0.03), new THREE.Vector3(0.34, 0.07, 0.03)],
    [new THREE.Vector3(-0.09, 0.3, 0), new THREE.Vector3(-0.2, 0.07, 0.02), new THREE.Vector3(-0.4, 0.08, 0.03)],
  ];
  for (const [hip, knee, foot] of legs) {
    seg(limb(0.07, PANTS, body), hip, knee);
    const shin = limb(0.06, LEATHER, body); seg(shin, knee, foot);
    ball(0.07, PANTS, body, knee.x, knee.y, knee.z);
    const boot = ball(0.068, DARK, body, foot.x + 0.03, foot.y - 0.01, foot.z); boot.scale.set(1.35, 0.7, 0.95);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; group.add(shadow);

  // --- head
  const head = new THREE.Group(); head.position.set(0, 0.93, -0.09); head.scale.setScalar(1.3); body.add(head);
  const neck = limb(0.05, SKIN_D, body); seg(neck, new THREE.Vector3(0, 0.64, 0), new THREE.Vector3(0, 0.8, -0.07));
  const skull = ball(0.13, SKIN, head); skull.scale.set(0.95, 1.06, 1);
  const jaw = ball(0.09, SKIN, head, 0, -0.06, 0.035); jaw.scale.set(1, 0.8, 0.95);
  // messy hair: cap + tufts + bangs
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.142, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), HAIR);
  cap.position.set(0, 0.012, -0.012); cap.rotation.x = -0.18; head.add(cap);
  const nape = ball(0.11, HAIR, head, 0, -0.01, -0.06); nape.scale.set(1.05, 1.0, 0.85);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), i % 2 ? HAIR : HAIR_L);
    t.position.set(Math.sin(a) * 0.09, 0.075 + (i % 3) * 0.006, Math.cos(a) * 0.09 - 0.02);
    t.rotation.set(Math.cos(a) * 0.9 + 0.3, 0, -Math.sin(a) * 0.9); head.add(t);
  }
  for (let i = -1; i <= 1; i++) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), HAIR);
    b.position.set(i * 0.05, 0.085, 0.105); b.rotation.set(Math.PI * 0.62, 0, i * 0.35); head.add(b);
  }
  // face
  const eyes = [];
  for (const s of [1, -1]) {
    const eg = new THREE.Group(); eg.position.set(0.05 * s, 0.01, 0.117); head.add(eg);
    const w = ball(0.024, EYE_W, eg); w.scale.set(1, 0.62, 0.45);
    const ir = ball(0.0155, EYE_G, eg, 0, 0, 0.007); ir.scale.set(1, 0.85, 0.4);
    const pu = ball(0.0075, BLACK, eg, 0, 0, 0.011);
    eyes.push(eg);
  }
  const brows = [];
  for (const s of [1, -1]) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.011, 0.012), BROW);
    br.position.set(0.05 * s, 0.045, 0.121); head.add(br); br.userData.side = s; brows.push(br);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.045, 6), SKIN_D);
  nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.012, 0.135); head.add(nose);
  const mouths = {
    flat: new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.008), DARK),
    smile: new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 12, Math.PI), DARK),
    frown: new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 12, Math.PI), DARK),
    open: new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), DARK),
  };
  mouths.smile.rotation.z = Math.PI; mouths.smile.position.set(0, -0.045, 0.118);
  mouths.frown.position.set(0, -0.075, 0.115);
  mouths.flat.position.set(0, -0.062, 0.118);
  mouths.open.position.set(0, -0.064, 0.118); mouths.open.scale.set(1.3, 1, 0.5);
  Object.values(mouths).forEach((x) => { x.visible = false; head.add(x); });
  // scruffy stubble patch
  // long half-elf ears
  const ears = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(0.122 * s, 0.015, -0.01); pivot.rotation.y = 0.55 * s; head.add(pivot);
    const g = new THREE.ConeGeometry(0.038, 0.27, 8); g.translate(0, 0.135, 0);
    const ear = new THREE.Mesh(g, SKIN); ear.rotation.z = -s * (Math.PI / 2 - 0.75); ear.scale.z = 0.45; pivot.add(ear);
    const inner = new THREE.Mesh(g.clone(), SKIN_D); inner.scale.set(0.55, 0.78, 0.5); inner.position.z = 0.004; ear.add(inner);
    ears.push({ pivot, ear, base: ear.rotation.z, s });
  }
  // long braid down the back of the head (swings with the pose)
  const braid = new THREE.Group(); braid.position.set(0, 0.0, -0.13); head.add(braid);
  for (let i = 0; i < 4; i++) { const b = ball(0.05 - i * 0.006, i % 2 ? HAIR : HAIR_L, braid, 0, -0.03 - i * 0.06, -0.03 - i * 0.01); b.scale.set(1, 1.2, 0.9); }
  const braidTie = ball(0.02, GOLD, braid, 0, -0.03 - 4 * 0.06, -0.03 - 4 * 0.01);

  // --- arms
  const arms = [L_SHOULDER, R_SHOULDER].map((S) => {
    const up = limb(0.058, TUNIC, body), low = limb(0.05, TUNIC, body);
    const hand = ball(0.058, LEATHER, body), shoulder = ball(0.075, LEATHER, body, S.x, S.y + 0.015, S.z); shoulder.scale.set(1, 0.8, 1);
    return { S, up, low, hand, elbow: new THREE.Vector3(), joint: ball(0.055, TUNIC, body) };
  });

  // --- outfit accessories (toggled by the chosen outfit) + power aura
  const plates = new THREE.Group(); body.add(plates);
  const cuirass = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), PLATE); cuirass.scale.set(1.12, 1.3, 1.05); cuirass.position.set(0, 0.5, 0); plates.add(cuirass);
  for (const sx of [1, -1]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8), PLATE); p.scale.set(1, 0.7, 1.15); p.position.set(0.155 * sx, 0.69, 0); plates.add(p);
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 14), GOLD); ridge.rotation.x = Math.PI / 2; ridge.position.set(0.155 * sx, 0.67, 0); plates.add(ridge);
  }
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

  const state = { draw: 0, drawTarget: 0, loaded: true, kick: 99, turn: 0, turnTarget: 0, mood: 'focus', moodT: 0, blink: 3, twitch: 2, drawing: false, bowId: 'elven', arrowStyle: 'broadhead', overdrive: false, look: { tier: 0, gold: false, steady: false, triple: false }, perkAura: 0, outfitAura: 0 };

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

  function setMood(mood, secs = 1.2) { state.mood = mood; state.moodT = secs; }
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
    const turn = state.turn;
    const mix = turn * turn * (3 - 2 * turn);

    group.rotation.y = THREE.MathUtils.lerp(Math.PI / 2, 0.2, mix);
    head.rotation.y = THREE.MathUtils.lerp(Math.PI / 2 * 0.92, 0, mix);
    head.rotation.x = (state.mood === 'sad' && !state.drawing ? 0.35 : 0) * mix + Math.sin(t * 1.3) * 0.01;
    body.position.y = Math.sin(t * 1.9) * 0.004;
    braid.rotation.x = 0.25 + Math.sin(t * 1.7) * 0.05 + state.draw * 0.1;
    torso.scale.set(1, 1 + Math.sin(t * 1.9) * 0.015, 1);

    // string + nock
    const vib = state.kick < 0.6 ? Math.sin(state.kick * 70) * Math.exp(-state.kick * 11) * 0.05 : 0;
    const pull = STRING_REST + DRAW_LEN * state.draw + (state.loaded ? 0 : -0.0) - vib * (state.loaded ? 0 : 1);
    const nock = tmpA.set(0, 0, pull);
    seg(stringTop, bow.tipTop, nock);
    seg(stringBot, bow.tipBot, nock);
    arrowSlot.position.copy(nock);
    nockedArrow.visible = state.loaded;
    bow.spin.forEach((s, i) => { s.rotation.x += dt * (i ? -1.5 : 1); });

    // hand targets
    const leftAim = GRIP.clone(); leftAim.y += Math.sin(t * 1.4) * 0.003;
    const rightAim = new THREE.Vector3(GRIP.x - pull, GRIP.y, 0);
    const sad = state.mood === 'sad';
    const leftAlt = sad ? new THREE.Vector3(0.3, 0.42, 0.14) : new THREE.Vector3(0.3, 1.04 + Math.sin(t * 9) * 0.03 * (state.mood === 'cheer' ? 1 : 0), 0.15);
    const rightAlt = sad ? new THREE.Vector3(-0.0, 0.96, 0.1) : new THREE.Vector3(-0.3, 1.04 + Math.cos(t * 9) * 0.03 * (state.mood === 'cheer' ? 1 : 0), 0.15);
    const targets = [leftAim.lerp(leftAlt, mix), rightAim.lerp(rightAlt, mix)];
    const poles = [
      new THREE.Vector3(0, -1, -0.3),
      new THREE.Vector3(0, 1, -0.3).lerp(new THREE.Vector3(-1, -0.2, -0.2), mix),
    ];
    arms.forEach((a, i) => {
      const hand = solveArm(a.S, targets[i], poles[i], a.elbow);
      seg(a.up, a.S, a.elbow); seg(a.low, a.elbow, hand);
      a.hand.position.copy(hand); a.joint.position.copy(a.elbow);
      if (i === 0) {
        bowPivot.position.copy(hand);
        bowPivot.rotation.z = mix * (sad ? -0.9 : 0.7);
      }
    });

    // power aura + paladin halo
    const auraCol = state.perkAura || state.outfitAura;
    aura.visible = !!auraCol;
    if (auraCol) { aura.material.color.setHex(auraCol); aura.material.opacity = (state.perkAura ? 0.5 : 0.28) + Math.sin(t * 3.2) * 0.1; aura.scale.setScalar(1.7 + Math.sin(t * 2.4) * 0.12); }
    if (halo.visible) { halo.position.y = 1.27 + Math.sin(t * 2) * 0.012; halo.rotation.z += dt * 0.8; }

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
    release() { state.drawTarget = 0; state.draw = Math.min(state.draw, 0.35); state.kick = 0; state.loaded = false; state.drawing = false; },
    react(mood, secs) { setMood(mood, secs); },
    setBow(id) { state.bowId = id; rebuildBow(); },
    setArrowStyle(style) { state.arrowStyle = style; rebuildArrow(); },
    arrowStyle: () => (bow && bow.arrowStyle) || state.arrowStyle,
    bowInfo: () => bow,
    setOutfit(o) {
      TUNIC.color.setHex(o.tunic); CLOAK.color.setHex(o.cloak); LEATHER.color.setHex(o.leather); GOLD.color.setHex(o.trim);
      PLATE.color.setHex(o.plate); EYE_G.color.setHex(o.eyes);
      plates.visible = o.plates; halo.visible = o.halo; state.outfitAura = o.aura;
    },
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
