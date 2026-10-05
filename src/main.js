import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { Sfx } from './audio.js';
import { createElf } from './elf.js';
import { buildArrow, buildOverdriveBolt, decorateArrow, BOWS, PACKS, OUTFITS, ARROW_LENGTH } from './weapons.js';
import { buildScenery, buildGantry, buildEggStation, AIM_X, AIM_Y, ELF_Z, CARD_Z, EGG_Z, PEND_L, PIVOT_Y } from './world.js';
import { buildCard, buildChain, layoutChain } from './card.js';
import { Particles } from './particles.js';
import { ENVS, AMBIENT } from './env.js';
import { createArmory, ARMORY_W, ARMORY_H, ARMORY_WORLD_W } from './armory.js';
import { Panel, roundRect, text, drawCoin, drawFlame, drawArrowIcon, wrapLines } from './panel.js';

// ---------------------------------------------------------------- setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking', 'local-floor'] }));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
const DESK_CAM = new THREE.Vector3(0.55, 1.3, 1.25);
const DESK_LOOK = new THREE.Vector3(-0.35, 1.0, -7);
const camParam = new URLSearchParams(location.search).get('cam'); // debug: ?cam=x,y,z,lx,ly,lz
if (camParam) { const v = camParam.split(',').map(Number); DESK_CAM.set(v[0], v[1], v[2]); DESK_LOOK.set(v[3], v[4], v[5]); }
camera.position.copy(DESK_CAM); camera.lookAt(DESK_LOOK);
const DESIGN_EYE = 1.18; // seated eye height the layout is designed around

scene.add(camera); // lets screen-anchored UI (desktop HUD) be a child of the camera
const world = new THREE.Group(); // recentered/raised in VR so the lane sits at a comfortable seated height
scene.add(world);
const scenery = buildScenery(scene); world.add(scenery.group);
const gantry = buildGantry(); world.add(gantry);
const station = buildEggStation(); world.add(station.group);
const sfx = new Sfx();
const particles = new Particles(900); world.add(particles.mesh);

// ---------------------------------------------------------------- persistent save
const SAVE_KEY = 'elf-archery-xr-v1';
const save = (() => {
  const def = { coins: 120, bows: ['elven'], packs: ['medieval'], bow: 'elven', pack: 'medieval', outfits: ['ranger'], outfit: 'ranger', ui: { large: false, voice: false }, best: 0, bestScore: 0, bestStage: 1 };
  try { return { ...def, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return def; }
})();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };

// ---------------------------------------------------------------- the elf
const elf = createElf();
elf.group.position.set(0, 0, ELF_Z);
world.add(elf.group);

// Character loading. Preferred: a real rigged .glb at assets/models/elf.glb (must contain a skinned mesh, or be a
// flat image card). Anything else (e.g. an un-skinned box) is ignored and the cutout art cards are used instead,
// and if those are missing the procedural elf stays.
async function loadElfCard() {
  try {
    const tl = new THREE.TextureLoader();
    const [f, b] = await Promise.all([tl.loadAsync('./assets/models/elf-card-front.webp'), tl.loadAsync('./assets/models/elf-card-back.webp')]);
    elf.useCard(f, b);
    return true;
  } catch (e) { console.warn('elf card art not loaded:', e); return false; }
}
async function loadElfModel(url = './assets/models/elf.glb') {
  try {
    if (!url.startsWith('blob:')) { const head = await fetch(url, { method: 'HEAD' }); if (!head.ok) return loadElfCard(); }
    const gltf = await new GLTFLoader().loadAsync(url);
    let skinned = false; gltf.scene.traverse((o) => { if (o.isSkinnedMesh) skinned = true; });
    const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
    if (skinned || size.z < size.y * 0.15) { elf.useModel(gltf.scene, gltf.animations || []); return true; }
    console.warn('elf.glb has no skinned mesh and is not a flat card; using the cutout art instead');
  } catch (e) { console.warn('elf model not loaded:', e); }
  return loadElfCard();
}
// The procedural elf is the default character. Add ?art=1 to the URL to use assets/models/elf.glb (or the cutout art) instead.
if (new URLSearchParams(location.search).has('art')) loadElfModel();

// ---------------------------------------------------------------- pendulum + card
const swing = new THREE.Group(); swing.position.set(0, PIVOT_Y, CARD_Z); gantry.add(swing);
const cardHolder = new THREE.Group(); cardHolder.position.set(0, -PEND_L, 0); swing.add(cardHolder);
const chain = buildChain(); swing.add(chain);
let cardVisual = null;
let cardKey = '';
const cardState = { hole: 0.25, shake: 0, hidden: 0, respawn: 0 };

function rebuildCard() {
  const a = cardState.hole, b = a * 1.3;
  const key = `${save.pack}:${a.toFixed(3)}`;
  if (key === cardKey) return;
  cardKey = key;
  if (cardVisual) cardHolder.remove(cardVisual);
  cardVisual = buildCard(save.pack, a, b);
  cardHolder.add(cardVisual);
  layoutChain(chain, PEND_L - cardVisual.userData.topY);
}

const pend = { phase: 0, amp: 1.0, period: 5.0, lastCos: 1, speedMul: 1 };
function stageParams(stage) {
  return {
    // ~12% faster every stage (5.0s -> 1.7s per swing by stage ~10), then difficulty keeps growing via arc, harmonics, smaller cutout
    period: Math.max(1.7, 5.0 * Math.pow(0.88, stage - 1)),
    amp: Math.min(1.7, 1.0 + 0.035 * (stage - 1)),
    hole: Math.max(0.13, 0.25 - 0.0055 * (stage - 1)),
    harm: stage > 10 ? Math.min(0.35, 0.05 * (stage - 10)) : 0,
  };
}
const thetaAt = (phase) => {
  const thMax = Math.asin(Math.min(0.9, pend.amp / PEND_L));
  return thMax * (Math.sin(phase) + pend.harm * Math.sin(phase * 1.7 + 1.0)) / (1 + pend.harm);
};
function cardCenterAt(phase) {
  const th = thetaAt(phase);
  return { x: Math.sin(th) * PEND_L, y: PIVOT_Y - Math.cos(th) * PEND_L, th };
}

// ---------------------------------------------------------------- reticle / aim guide
const reticle = new THREE.Group();
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.1, 0.115, 40), ringMat));
for (const [w, h] of [[0.06, 0.012], [0.012, 0.06]]) reticle.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), ringMat));
reticle.position.set(AIM_X, AIM_Y, CARD_Z + 0.5);
world.add(reticle);
const aimDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }), 22);
{ const m = new THREE.Matrix4(); for (let i = 0; i < 22; i++) { m.setPosition(AIM_X, AIM_Y, -2.3 - i * 0.28); aimDots.setMatrixAt(i, m); } }
world.add(aimDots);

// ---------------------------------------------------------------- game state
const G = {
  state: 'menu', // menu | playing | over
  runActive: false,
  score: 0, newBest: false, stage: 1, hits: 0, streak: 0, lives: 3, overdrive: 0, bestRunStreak: 0, runCoins: 0,
  loaded: true, reload: 0, drawing: null, drawT: 0, lastResult: '',
  perks: { triple: 0, steady: 0, gold: 0, slowT: 0 }, perkTimer: 5, slowShown: 0,
};
const OVERDRIVE_MAX = 6;
const STAGE_NAMES = ENVS.map((e) => e.name);
const envFor = (stage) => ENVS[(stage - 1) % ENVS.length];
const stageName = () => STAGE_NAMES[(G.stage - 1) % STAGE_NAMES.length];

let params = stageParams(1);
function applyStage(snap) {
  params = stageParams(G.state === 'playing' ? G.stage : 1);
  const calm = G.state === 'playing' ? 1 : 0.75;
  pend.period = params.period / (G.state === 'playing' ? 1 : 1.2);
  pend.targetAmp = params.amp * calm; pend.harm = params.harm;
  cardState.hole = params.hole;
  if (snap) pend.amp = pend.targetAmp;
  scenery.setEnv(envFor(G.stage), snap);
  rebuildCard();
}
pend.targetAmp = 1.0;
applyStage(true);

// ---------------------------------------------------------------- UI panels
// Score / streak panel sits at the upper left, angled toward the player, clear of the lane and target (the elf waits on the right).
const hud = new Panel(0.9, 0.495, 800, 440);
world.add(hud.mesh);
// Desktop: the HUD is pinned to the screen's top-left corner with a 20px margin.
// VR: it floats far to the left of the lane in world space (head-locked UI is uncomfortable in a headset).
function placeHud() {
  if (renderer.xr.isPresenting) {
    world.add(hud.mesh); hud.mesh.scale.setScalar(1); hud.mesh.position.set(-2.1, 1.5, -2.0); hud.mesh.rotation.set(0, 0.7, 0);
    hud.mesh.material.depthTest = true; hud.mesh.renderOrder = 0;
    world.add(lives.mesh); lives.mesh.scale.setScalar(1); lives.mesh.position.set(-2.0, 0.8, -1.9); lives.mesh.rotation.set(-0.15, 0.7, 0);
    lives.mesh.material.depthTest = true; lives.mesh.renderOrder = 0;
  } else {
    camera.add(hud.mesh);
    const d = 1.0, s = 0.62, halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d, halfW = halfH * camera.aspect;
    const margin = (20 / window.innerHeight) * 2 * halfH, w = 0.9 * s, h = 0.495 * s;
    hud.mesh.scale.setScalar(s); hud.mesh.rotation.set(0, 0, 0);
    hud.mesh.position.set(-halfW + margin + w / 2, halfH - margin - h / 2, -d);
    hud.mesh.material.depthTest = false; hud.mesh.renderOrder = 50;
    // Arrows / overdrive panel: bottom-left corner, same 20px margin
    camera.add(lives.mesh);
    const ls = 0.52, lw = 0.62 * ls, lh = 0.52 * ls;
    lives.mesh.scale.setScalar(ls); lives.mesh.rotation.set(0, 0, 0);
    lives.mesh.position.set(-halfW + margin + lw / 2, -halfH + margin + lh / 2, -d);
    lives.mesh.material.depthTest = false; lives.mesh.renderOrder = 50;
  }
  // Menu + Armory: big, centred screens
  const large = save.ui && save.ui.large;
  const centred = (mesh, ww, wh, vrPos, vrScale) => {
    if (renderer.xr.isPresenting) {
      world.add(mesh); mesh.scale.setScalar(vrScale); mesh.position.set(...vrPos); mesh.rotation.set(0, 0, 0);
      mesh.material.depthTest = true; mesh.renderOrder = 0;
    } else {
      camera.add(mesh);
      const d = 1.0, halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d, halfW = halfH * camera.aspect;
      const sc = Math.min((0.92 * 2 * halfW) / ww, (0.88 * 2 * halfH) / wh);
      mesh.scale.setScalar(sc); mesh.rotation.set(0, 0, 0); mesh.position.set(0, 0, -d);
      mesh.material.depthTest = false; mesh.renderOrder = 60;
    }
  };
  centred(menu.mesh, 1.6, 1.6 * 560 / 1024, [0, 1.35, -1.9], large ? 1.25 : 1);
  if (armory) centred(armory.panel.mesh, ARMORY_WORLD_W, ARMORY_WORLD_W * ARMORY_H / ARMORY_W, [0, 1.4, -1.85], large ? 1.3 : 1);
}
const lives = new Panel(0.62, 0.52, 496, 416);
world.add(lives.mesh); // positioned by placeHud()
const menu = new Panel(1.6, 1.6 * 560 / 1024, 1024, 560);
world.add(menu.mesh); // positioned by placeHud()
let armory = null; // the Armory view (created below, once the upgrade orb data exists)
const flags = { hud: true, lives: true, menu: true };

function drawHud() {
  const c = hud.begin();
  c.fillStyle = 'rgba(8,14,30,0.7)'; roundRect(c, 4, 4, 792, 432, 40); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 4; c.stroke();
  // menu / settings (top-left of the panel)
  c.fillStyle = hud.hover === 'menu' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)'; roundRect(c, 24, 24, 250, 86, 26); c.fill();
  c.fillStyle = '#fff'; c.fillRect(54, 46, 12, 42); c.fillRect(80, 46, 12, 42);
  text(c, 'MENU', 112, 68, { size: 42 });
  hud.button('menu', 24, 24, 250, 86);
  // stage
  text(c, `STAGE ${G.stage}`, 776, 54, { size: 50, color: '#ffffff', align: 'right' });
  text(c, stageName(), 776, 100, { size: 32, color: '#cfe8ff', align: 'right', weight: 600 });
  // streak (left) and score (right)
  text(c, 'STREAK', 40, 176, { size: 34, color: '#ffd7a0' });
  drawFlame(c, 70, 270, 42);
  text(c, String(G.streak), 128, 272, { size: 120, color: G.streak >= 5 ? '#ffb23a' : '#ffffff' });
  text(c, 'SCORE', 776, 176, { size: 34, color: '#ffd7a0', align: 'right' });
  text(c, G.score.toLocaleString(), 776, 250, { size: 80, color: '#ffe58a', align: 'right' });
  // best is a max across runs, not a running total
  text(c, `BEST ${Math.max(save.bestScore, G.score).toLocaleString()}`, 776, 330, { size: 40, color: G.score > save.bestScore ? '#7dff9a' : '#9fc9e8', align: 'right' });
  if (G.streak > 0) text(c, G.streak >= 10 ? 'STORM ARROWS' : G.streak >= 6 ? 'ARROWS ON FIRE' : G.streak >= 3 ? 'HEATING UP' : '', 40, 388, { size: 30, color: '#ffb347', weight: 700 });
  hud.end();
}

function drawLives() {
  const c = lives.begin();
  c.fillStyle = 'rgba(8,14,30,0.62)'; roundRect(c, 4, 4, 488, 408, 36); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 4; c.stroke();
  text(c, 'ARROWS', 248, 50, { size: 40, color: '#cfe8ff', align: 'center' });
  const n = Math.max(3, G.lives), sp = Math.min(140, 400 / n);
  for (let i = 0; i < n; i++) drawArrowIcon(c, 248 - sp * (n - 1) / 2 + i * sp, 120, 70, i < G.lives ? '#ffe0a0' : '#ff6b6b', i >= G.lives);
  const ready = G.overdrive >= OVERDRIVE_MAX;
  const pulse = ready ? 0.65 + 0.35 * Math.sin(performance.now() / 120) : 0;
  c.fillStyle = 'rgba(255,255,255,0.14)'; roundRect(c, 40, 190, 416, 44, 22); c.fill();
  const frac = Math.min(1, G.overdrive / OVERDRIVE_MAX);
  c.fillStyle = ready ? `rgba(255,${170 + 60 * pulse | 0},40,1)` : '#4fc3ff'; roundRect(c, 40, 190, Math.max(44, 416 * frac), 44, 22); c.fill();
  if (ready) {
    c.shadowColor = '#ffb03a'; c.shadowBlur = 30 * pulse;
    text(c, 'OVERDRIVE READY!', 248, 272, { size: 42, color: '#ffe08a', align: 'center' });
    c.shadowBlur = 0;
  } else text(c, `OVERDRIVE ${G.overdrive}/${OVERDRIVE_MAX}`, 248, 272, { size: 36, color: '#9fc9e8', align: 'center' });
  // active upgrades
  const chips = [];
  if (G.perks.triple > 0) chips.push(['TRIPLE x' + G.perks.triple, PERKS.triple.color]);
  if (G.perks.steady > 0) chips.push(['STEADY x' + G.perks.steady, PERKS.steady.color]);
  if (G.perks.gold > 0) chips.push(['GOLD x' + G.perks.gold, PERKS.gold.color]);
  if (G.perks.slowT > 0) chips.push(['SLOW ' + Math.ceil(G.perks.slowT) + 's', PERKS.slow.color]);
  if (!chips.length) text(c, 'Shoot glowing orbs for upgrades', 248, 360, { size: 26, color: '#8fb0cc', align: 'center', weight: 600, shadow: false });
  chips.forEach(([label, col], i) => {
    const x = 28 + (i % 2) * 220, y = 306 + Math.floor(i / 2) * 52;
    c.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(c, x, y, 212, 44, 22); c.fill();
    c.strokeStyle = col; c.lineWidth = 4; c.stroke();
    text(c, label, x + 106, y + 23, { size: 28, color: col, align: 'center', shadow: false });
  });
  lives.end();
}

let menuNote = '';
function drawMenu() {
  const c = menu.begin();
  const hv = (id) => menu.hover === id;
  c.fillStyle = 'rgba(6,10,24,0.94)'; roundRect(c, 4, 4, 1016, 552, 48); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 6; c.stroke();
  const over = G.state === 'over';
  text(c, over ? 'GAME OVER' : 'ELF ARCHERY RANGE', 512, 62, { size: 72, color: over ? '#ffb0b0' : '#ffe9b0', align: 'center' });
  const sub = over ? `${G.newBest ? 'NEW BEST!  ' : ''}Score ${G.score.toLocaleString()}.  Best ${save.bestScore.toLocaleString()}.  Longest streak ${G.bestRunStreak}.`
    : menuNote || 'Pinch and hold to draw, release to shoot. Thread the cutout, and shoot glowing orbs for upgrades.';
  wrapLines(c, sub, 940, 36, 600).slice(0, 3).forEach((ln, k) => text(c, ln, 512, 128 + k * 44, { size: 36, color: '#e8f2ff', align: 'center', weight: 600, shadow: false }));

  const playLabel = G.runActive ? 'RESUME' : over ? 'PLAY AGAIN' : 'PLAY';
  c.fillStyle = hv('play') ? '#ffffff' : '#37c75c'; roundRect(c, 40, 270, 590, 140, 32); c.fill();
  text(c, playLabel, 335, 342, { size: 76, color: '#06240f', shadow: false, align: 'center' });
  menu.button('play', 40, 270, 590, 140);
  c.fillStyle = hv('armory') ? '#ffffff' : '#ffe9b0'; roundRect(c, 650, 270, 334, 140, 32); c.fill();
  text(c, 'ARMORY', 817, 330, { size: 56, color: '#1b1530', shadow: false, align: 'center' });
  text(c, 'bows, arrows, outfits', 817, 378, { size: 28, color: '#3a2e5a', shadow: false, align: 'center', weight: 700 });
  menu.button('armory', 650, 270, 334, 140);

  c.fillStyle = hv('recenter') ? '#ffffff' : 'rgba(255,255,255,0.16)'; roundRect(c, 40, 430, 470, 100, 28); c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.stroke();
  text(c, 'RECENTER VIEW', 275, 480, { size: 44, color: hv('recenter') ? '#0b1226' : '#ffffff', align: 'center', shadow: false });
  menu.button('recenter', 40, 430, 470, 100);
  drawCoin(c, 580, 472, 30); text(c, `${save.coins.toLocaleString()} coins`, 625, 474, { size: 48, color: '#ffe58a' });
  text(c, `Best ${save.bestScore.toLocaleString()}`, 984, 520, { size: 30, color: '#cfe8ff', align: 'right', weight: 600, shadow: false });
  menu.end();
}

function refreshUi(force) {
  const showMenu = G.state === 'menu' || G.state === 'over', showArmory = G.state === 'armory';
  if (menu.mesh.visible !== showMenu) { menu.mesh.visible = showMenu; flags.menu = true; }
  if (armory && armory.panel.mesh.visible !== showArmory) { armory.panel.mesh.visible = showArmory; armory.dirty = true; }
  hud.mesh.visible = G.state === 'playing'; // menus already show the score
  lives.mesh.visible = G.state === 'playing';
  const hintEl = document.getElementById('hint'); if (hintEl) hintEl.style.display = G.state === 'playing' && !renderer.xr.isPresenting ? '' : 'none';
  if (flags.hud || force) { drawHud(); flags.hud = false; }
  if (flags.menu && showMenu) { drawMenu(); flags.menu = false; }
  if (armory && showArmory && armory.dirty) armory.draw();
  if (flags.lives || G.overdrive >= OVERDRIVE_MAX) { drawLives(); flags.lives = false; }
}

// ---------------------------------------------------------------- popups
const popups = [];
function popup(str, color, pos, scale = 1, life = 1.4) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 192;
  const x = c.getContext('2d'); x.font = '900 104px system-ui, "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 16; x.strokeStyle = 'rgba(10,14,30,0.9)'; x.lineJoin = 'round'; x.strokeText(str, 384, 100);
  x.fillStyle = color; x.fillText(str, 384, 100);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  sp.renderOrder = 20; sp.position.copy(pos); sp.userData = { life, max: life, base: scale, y0: pos.y };
  world.add(sp); popups.push(sp);
}

// ---------------------------------------------------------------- arrows, effects
const arrows = [];
const stuck = [];
const debris = [];
const rings = [];
const shatter = [];
const ARROW_SPEED = 58;

function haptic(strength = 0.6, ms = 40) {
  try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch { /* ignore */ }
  const s = renderer.xr.getSession && renderer.xr.getSession();
  if (!s) return;
  for (const src of s.inputSources) {
    const act = src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0];
    try { act && act.pulse && act.pulse(strength, ms); } catch { /* no haptics on hands */ }
  }
}

function currentArrowStyle() {
  const bow = elf.bowInfo();
  return (bow && bow.arrowStyle) || (save.pack === 'scifi' ? 'plasma' : 'broadhead');
}
function syncLoadout() {
  elf.setBow(save.bow);
  elf.setOutfit(OUTFITS.find((o) => o.id === save.outfit) || OUTFITS[0]);
  elf.setArrowStyle(save.pack === 'scifi' ? 'plasma' : 'broadhead');
  rebuildCard();
}

const tmpV = new THREE.Vector3();
const cardWorldCenter = () => { const c = cardCenterAt(pend.phase); return tmpV.set(c.x, c.y, CARD_Z); };

// arrow heat tier from the streak: 3 = warm, 6 = fire, 10 = storm
const tierOf = (streak) => (streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1 : 0);
const TIER_AURA = [0, 0xffb347, 0xff6a1a, 0x9fe8ff];
let lookKey = '';
function syncUpgradeLook() {
  const overdrive = G.overdrive >= OVERDRIVE_MAX;
  const look = { tier: tierOf(G.streak), gold: G.perks.gold > 0, steady: G.perks.steady > 0, triple: !overdrive && G.perks.triple > 0 };
  const key = JSON.stringify(look) + overdrive;
  if (key === lookKey) return; lookKey = key;
  elf.setArrowLook(look);
  elf.setAura(look.gold ? 0xffd24a : look.triple ? 0xffb23a : look.steady ? 0x6dd5ff : G.perks.slowT > 0 ? 0xc9a8ff : TIER_AURA[look.tier]);
}

// ---------------------------------------------------------------- upgrade orbs (shoot them for perks)
const PERKS = {
  triple: { name: 'TRIPLE SHOT', color: '#ffb23a', hex: 0xffb23a, weight: 3 },
  steady: { name: 'STEADY HANDS', color: '#6dd5ff', hex: 0x6dd5ff, weight: 3 },
  slow: { name: 'HOURGLASS', color: '#c9a8ff', hex: 0xc9a8ff, weight: 2 },
  heart: { name: 'EXTRA ARROW', color: '#ff6b8a', hex: 0xff6b8a, weight: 1.5 },
  gold: { name: 'GOLDEN ARROW', color: '#ffe14a', hex: 0xffe14a, weight: 2 },
  charge: { name: 'OVERCHARGE', color: '#ff8a1f', hex: 0xff8a1f, weight: 2 },
};
const perkOrbs = [];
const iconCache = {};
function perkTexture(type) {
  if (iconCache[type]) return iconCache[type];
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'); const col = PERKS[type].color;
  const g = x.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, col); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#1b1530'; x.strokeStyle = '#1b1530'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
  const poly = (pts) => { x.beginPath(); pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath(); x.fill(); };
  if (type === 'triple') { for (const px of [40, 64, 88]) { x.beginPath(); x.moveTo(px, 94); x.lineTo(px, 48); x.stroke(); poly([[px, 32], [px - 9, 50], [px + 9, 50]]); } }
  else if (type === 'steady') { x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 30, 0, 7); x.stroke(); x.beginPath(); x.arc(64, 64, 12, 0, 7); x.fill(); x.beginPath(); x.moveTo(64, 20); x.lineTo(64, 38); x.moveTo(64, 90); x.lineTo(64, 108); x.moveTo(20, 64); x.lineTo(38, 64); x.moveTo(90, 64); x.lineTo(108, 64); x.stroke(); }
  else if (type === 'slow') { poly([[38, 30], [90, 30], [64, 64]]); poly([[64, 64], [38, 98], [90, 98]]); x.fillRect(34, 26, 60, 6); x.fillRect(34, 96, 60, 6); }
  else if (type === 'heart') { x.beginPath(); x.moveTo(64, 98); x.bezierCurveTo(14, 64, 30, 22, 64, 48); x.bezierCurveTo(98, 22, 114, 64, 64, 98); x.fill(); }
  else if (type === 'gold') { const pts = []; for (let k = 0; k < 10; k++) { const r = k % 2 ? 16 : 38, a = -Math.PI / 2 + (k * Math.PI) / 5; pts.push([64 + Math.cos(a) * r, 66 + Math.sin(a) * r]); } poly(pts); }
  else { poly([[72, 20], [40, 70], [60, 70], [52, 108], [88, 54], [66, 54]]); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return (iconCache[type] = tex);
}
function pickPerkType() {
  const pool = Object.entries(PERKS).filter(([k]) => !(k === 'heart' && G.lives >= 5) && !(k === 'charge' && G.overdrive >= OVERDRIVE_MAX) && !(k === 'slow' && G.perks.slowT > 0));
  let r = Math.random() * pool.reduce((a, [, p]) => a + p.weight, 0);
  for (const [k, p] of pool) { r -= p.weight; if (r <= 0) return k; }
  return pool[0][0];
}
function spawnPerk() {
  const type = pickPerkType();
  const grp = new THREE.Group();
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: perkTexture(type), transparent: true, depthWrite: false, toneMapped: false })); icon.scale.setScalar(0.62); icon.renderOrder = 6;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: perkTexture(type), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); halo.scale.setScalar(1.0); halo.renderOrder = 5;
  grp.add(halo, icon);
  const z = -3.8 - Math.random() * 3.4, A = 1.3 + Math.random() * 0.5;
  const orb = { type, group: grp, icon, halo, t: 0, life: 16, A, w: (Math.PI * 2) / (3.2 + Math.random() * 1.6), ph: Math.random() * 6.28, z, r: 0.3 };
  grp.position.set(0, AIM_Y, z); world.add(grp); perkOrbs.push(orb);
  sfx.perkSpawn();
}
function removePerk(o) { world.remove(o.group); o.icon.material.dispose(); o.halo.material.dispose(); perkOrbs.splice(perkOrbs.indexOf(o), 1); }
function clearPerks() { while (perkOrbs.length) removePerk(perkOrbs[0]); }
function collectPerk(o) {
  const P = PERKS[o.type]; const pos = o.group.position.clone();
  sfx.perk(); haptic(0.7, 60);
  if (o.type === 'triple') G.perks.triple = 3;
  else if (o.type === 'steady') G.perks.steady = 4;
  else if (o.type === 'gold') G.perks.gold = 3;
  else if (o.type === 'slow') G.perks.slowT = 10;
  else if (o.type === 'heart') G.lives = Math.min(5, G.lives + 1);
  else if (o.type === 'charge') { G.overdrive = Math.min(OVERDRIVE_MAX, G.overdrive + 3); if (G.overdrive >= OVERDRIVE_MAX && !elfOverdrive) { elfOverdrive = true; sfx.overdriveReady(); } elf.setOverdrive(G.overdrive >= OVERDRIVE_MAX); }
  popup(P.name + '!', P.color, pos.clone().add(new THREE.Vector3(0, 0.55, 0.3)), 1.05, 1.5);
  particles.burst(pos, 60, { colors: [P.hex, 0xffffff], speed: 3.4, size: 0.07, life: 0.9, grav: 1 });
  particles.vortex(pos, 30, P.hex);
  elf.react('happy', 1.0);
  removePerk(o);
  flags.lives = true;
}
const rankOf = (r) => (r.kind === 'perfect' ? 2000 : r.kind === 'clip' ? 1000 + r.fit : 0);

function fireArrow() {
  const overdrive = G.overdrive >= OVERDRIVE_MAX;
  const startZ = ELF_Z - elf.nockForward();
  const triple = !overdrive && G.perks.triple > 0; if (triple) G.perks.triple--;
  const steady = G.perks.steady > 0; if (steady) G.perks.steady--;
  const gold = G.perks.gold > 0; if (gold) G.perks.gold--;
  if (triple || steady || gold) flags.lives = true;
  const group = triple ? { n: 3, results: [] } : null;
  let obj = null, len = ARROW_LENGTH;
  for (const dx of triple ? [-0.17, 0, 0.17] : [0]) {
    const o = overdrive ? buildOverdriveBolt() : decorateArrow(buildArrow(currentArrowStyle()), { tier: tierOf(G.streak), gold, steady });
    o.position.set(AIM_X + dx, AIM_Y, startZ);
    world.add(o);
    len = o.userData.length || ARROW_LENGTH;
    arrows.push({ obj: o, len, speed: overdrive ? ARROW_SPEED * 1.25 : ARROW_SPEED, overdrive, radius: overdrive ? 0.12 : 0.02, style: currentArrowStyle(), ringT: 0, done: false, dx, group, steady, gold });
    obj = o;
  }
  const bowId = save.bow;
  sfx.fire(bowId);
  haptic(0.5, 35);
  if (bowId === 'steampunk') {
    const p = elf.bowLocalToWorld(new THREE.Vector3(0, 0.2, -0.04));
    world.worldToLocal(p);
    particles.burst(p, 26, { colors: [0xffffff, 0xd8dde3], speed: 0.9, up: 0.9, size: 0.1, life: 1.2, grav: -0.6, drag: 1.2 });
  }
  particles.burst(new THREE.Vector3(AIM_X, AIM_Y, startZ - 0.5), 8, { colors: [obj.userData.trail || 0xffffff], speed: 1.2, size: 0.04, life: 0.4, grav: 0 });
  elf.release();
  elf.setOverdrive(false);
  G.loaded = false; G.reload = 0.55;
  if (overdrive) { G.overdrive = 0; flags.lives = true; }
}

function shake(amount) { cardState.shake = Math.max(cardState.shake, amount); camShake = Math.max(camShake, amount); }
let camShake = 0;

function confetti(n = 140) {
  const cols = [0xff5a5a, 0xffd23a, 0x5aff8a, 0x5ac8ff, 0xc07aff, 0xffffff];
  for (let i = 0; i < n; i++) {
    particles.spawn({
      x: (Math.random() - 0.5) * 3.2, y: 1.0 + Math.random() * 1.6, z: -1.4 - Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.6,
      grav: 1.4, drag: 0.35, size: 0.035 + Math.random() * 0.03, life: 1.5 + Math.random() * 0.8, color: cols[(Math.random() * cols.length) | 0],
    });
  }
}

function explodeCard(center) {
  const cols = (cardVisual && cardVisual.userData.debris) || [0x8a5a2e];
  for (let i = 0; i < 22; i++) {
    const s = 0.08 + Math.random() * 0.14;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * (0.5 + Math.random()), s * 0.4), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7 }));
    m.position.set(center.x + (Math.random() - 0.5) * 1.0, center.y + (Math.random() - 0.5) * 1.4, center.z);
    m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 5, 1 + Math.random() * 4, -1 + Math.random() * 4), r: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 1.6 };
    world.add(m); debris.push(m);
  }
  particles.burst(center, 90, { colors: [0xffc23a, 0xff7a1a, 0xffffff], speed: 6, size: 0.1, life: 1.1, grav: 3 });
  cardState.hidden = 1.3;
  cardHolder.visible = false;
}

function snapArrow(pos) {
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.28, 5), new THREE.MeshStandardMaterial({ color: 0x8c6a3f }));
    m.position.copy(pos); m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), 1.5 + Math.random() * 1.5), r: new THREE.Vector3(Math.random() * 12, Math.random() * 12, 0), life: 1.0 };
    world.add(m); debris.push(m);
  }
  particles.burst(pos, 14, { colors: [0xc9a36a, 0x8c6a3f], speed: 2.2, size: 0.03, life: 0.6, grav: 6 });
}

// ---------------------------------------------------------------- scoring
function resolveCrossing(a, frac, dt) {
  const phase = pend.phase - (1 - frac) * dt * (Math.PI * 2 / pend.period) * pend.speedMul;
  const c = cardCenterAt(phase);
  const ax = AIM_X + (a.dx || 0);
  const dx = ax - c.x, dy = AIM_Y - c.y;
  const cos = Math.cos(c.th), sin = Math.sin(c.th);
  const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
  const ha = cardState.hole - a.radius, hb = cardState.hole * 1.3 - a.radius;
  const k = a.steady ? 1.5 : 1; // Steady Hands: bigger effective cutout
  const d = a.overdrive ? Math.hypot(lx / (cardState.hole * 0.9), ly / (cardState.hole * 1.17)) * 0.6 : Math.hypot(lx / (Math.max(0.02, ha) * k), ly / (Math.max(0.02, hb) * k));
  const center = new THREE.Vector3(c.x, c.y, CARD_Z);
  const pos = new THREE.Vector3(ax, AIM_Y, CARD_Z);
  const limit = a.overdrive ? 1.0 : 1.0;
  if (d >= limit) return { kind: 'miss', fit: Math.max(0, Math.round(100 - d * 40)), center, pos };
  if (a.overdrive || d <= 0.32) return { kind: 'perfect', fit: 100, center, pos, overdrive: a.overdrive };
  return { kind: 'clip', fit: Math.max(90, 99 - Math.floor(9 * (d - 0.32) / 0.68)), center, pos };
}

function applyResult(r) {
  const popPos = r.center.clone().add(new THREE.Vector3(0, 1.4, 0.4));
  if (r.kind === 'miss') {
    sfx.miss(); haptic(0.2, 25);
    snapArrow(r.pos);
    cardState.shake = Math.max(cardState.shake, 0.35);
    wobbleEgg(0.45);
    G.streak = 0; G.lives -= 1; flags.hud = flags.lives = true;
    popup('MISS', '#ff7b7b', popPos, 0.9);
    elf.react('sad', 1.4);
    if (G.lives <= 0) setTimeout(endRun, 700);
    return;
  }
  G.streak += 1; G.hits += 1; G.bestRunStreak = Math.max(G.bestRunStreak, G.streak);
  const perfect = r.kind === 'perfect';
  if (tierOf(G.streak) > tierOf(G.streak - 1)) {
    const t = tierOf(G.streak);
    sfx.perk();
    popup(['', 'ARROWS HEATING UP!', 'ARROWS ON FIRE!', 'STORM ARROWS!'][t], ['', '#ffb347', '#ff7a2a', '#9fe8ff'][t], new THREE.Vector3(0, 2.0, -3.4), 1.3, 1.8);
  }
  const bonus = Math.min(G.streak, 10);
  let coins = perfect ? 25 + bonus * 5 : 12 + bonus * 2;
  if (r.overdrive) coins += 100;
  if (r.gold) { coins *= 3; popup('GOLD x3', '#ffe14a', r.center.clone().add(new THREE.Vector3(0.9, 0.9, 0.4)), 0.7, 1.2); sfx.coin(); }
  save.coins += coins; G.runCoins += coins; G.score += coins; persist();
  if (perfect) {
    sfx.thock(); sfx.chime(G.streak);
    popup(r.overdrive ? 'OVERDRIVE!' : 'PERFECT SHOT!', r.overdrive ? '#ffb23a' : '#ffe14a', popPos, 1.15);
    particles.vortex(r.center, 80, r.overdrive ? 0xffb23a : 0x9fe8ff);
    confetti(r.overdrive ? 220 : 140);
    shake(0.6); haptic(1, 80);
    cardState.shake = 0.9;
    if (r.overdrive) { sfx.boom(); explodeCard(r.center); }
    elf.react('cheer', 1.6);
    G.overdrive = Math.min(OVERDRIVE_MAX, G.overdrive + 2);
  } else {
    sfx.clip(); sfx.chime(Math.max(0, G.streak - 2)); haptic(0.4, 40);
    popup(`CLIP! ${r.fit}%`, '#6dff9a', popPos, 1.0);
    particles.burst(r.pos, 40, { colors: [0x6dff9a, 0xc8ffd8], speed: 3.2, size: 0.05, life: 0.8, grav: 2 });
    cardState.shake = 0.5;
    elf.react('happy', 1.2);
    G.overdrive = Math.min(OVERDRIVE_MAX, G.overdrive + 1);
  }
  celebrateEgg(perfect);
  if (G.overdrive >= OVERDRIVE_MAX && !elfOverdrive) { elfOverdrive = true; sfx.overdriveReady(); }
  elf.setOverdrive(G.overdrive >= OVERDRIVE_MAX);
  if (G.hits % 3 === 0) {
    G.stage += 1; if (G.stage > save.bestStage) save.bestStage = G.stage;
    setTimeout(() => { sfx.stageUp(); popup(`STAGE ${G.stage} - FASTER!`, '#8fd6ff', new THREE.Vector3(0, 3.3, -6), 1.7, 2.0); applyStage(false); popup(envFor(G.stage).name, '#ffe9b0', new THREE.Vector3(0, 2.75, -6), 1.2, 2.6); G.perkTimer = Math.min(G.perkTimer, 1.5); flags.hud = true; }, 650);
  }
  flags.hud = flags.lives = true;
}
let elfOverdrive = false;

const eggFx = { wobble: 0, glow: 0, bounce: 0 };
function wobbleEgg(a) { eggFx.wobble = a; }
function celebrateEgg(perfect) { eggFx.glow = 1; eggFx.bounce = perfect ? 1 : 0.5; }

// ---------------------------------------------------------------- run control
function startRun() {
  if (!G.runActive) {
    Object.assign(G, { score: 0, newBest: false, stage: 1, hits: 0, streak: 0, lives: 3, overdrive: 0, bestRunStreak: 0, runCoins: 0, perks: { triple: 0, steady: 0, gold: 0, slowT: 0 }, perkTimer: 5 });
    clearPerks(); lookKey = '';
    elfOverdrive = false; elf.setOverdrive(false);
    G.runActive = true;
  }
  G.state = 'playing'; menuNote = '';
  applyStage(false);
  G.loaded = true; elf.setLoaded(true);
  flags.hud = flags.lives = flags.menu = true;
  sfx.click();
}
function endRun() {
  G.state = 'over'; G.runActive = false; clearPerks();
  if (G.bestRunStreak > save.best) save.best = G.bestRunStreak;
  G.newBest = G.score > save.bestScore;
  if (G.newBest) save.bestScore = G.score;
  persist(); sfx.gameOver();
  elf.react('sad', 2.5);
  applyStage(false);
  flags.hud = flags.menu = true;
}
function openArmory() { G.armoryFrom = G.state; G.state = 'armory'; menuNote = ''; flags.menu = true; sfx.click(); armory.open(); }
function closeArmory() { G.state = G.armoryFrom || 'menu'; flags.menu = true; flags.hud = true; }
function openMenu() { G.state = 'menu'; if (G.drawing) cancelDraw(); applyStage(false); flags.menu = flags.hud = true; sfx.click(); }

function equipBow(id) {
  save.bow = id; persist(); syncLoadout(); flags.menu = true;
}
function activate(btn) {
  const id = btn.id;
  if (id === 'play') return startRun();
  if (id === 'menu') return openMenu();
  if (id === 'armory') return openArmory();
  if (id.startsWith('arm:')) return armory.handle(id);
  if (id === 'recenter') { recenter(); sfx.click(); menuNote = 'View recentered.'; flags.menu = true; return; }
  if (id.startsWith('bow:')) {
    const b = BOWS.find((x) => x.id === id.slice(4));
    if (save.bows.includes(b.id)) { sfx.click(); equipBow(b.id); menuNote = `${b.name} equipped.`; }
    else if (save.coins >= b.cost) { save.coins -= b.cost; save.bows.push(b.id); sfx.coin(); equipBow(b.id); menuNote = `Unlocked the ${b.name}!`; }
    else { sfx.deny(); menuNote = `Need ${b.cost - save.coins} more coins for the ${b.name}.`; }
  } else if (id.startsWith('outfit:')) {
    const o = OUTFITS.find((x) => x.id === id.slice(7));
    if (save.outfits.includes(o.id)) { sfx.click(); save.outfit = o.id; menuNote = `${o.name} outfit equipped.`; }
    else if (save.coins >= o.cost) { save.coins -= o.cost; save.outfits.push(o.id); save.outfit = o.id; sfx.coin(); menuNote = `Unlocked the ${o.name} outfit!`; }
    else { sfx.deny(); menuNote = `Need ${o.cost - save.coins} more coins for the ${o.name} outfit.`; }
    persist(); syncLoadout();
  } else if (id.startsWith('pack:')) {
    const p = PACKS.find((x) => x.id === id.slice(5));
    if (save.packs.includes(p.id)) { sfx.click(); save.pack = p.id; menuNote = `${p.name} equipped.`; }
    else if (save.coins >= p.cost) { save.coins -= p.cost; save.packs.push(p.id); save.pack = p.id; sfx.coin(); menuNote = `Unlocked the ${p.name}!`; }
    else { sfx.deny(); menuNote = `Need ${p.cost - save.coins} more coins for the ${p.name}.`; }
    persist(); syncLoadout();
  }
  flags.menu = flags.hud = true;
  if (armory) armory.dirty = true;
}

// ---------------------------------------------------------------- input (mouse, keyboard, XR hand pinch)
const raycaster = new THREE.Raycaster();
const panels = () => (armory ? [armory.panel, menu, hud, lives] : [menu, hud, lives]);
function pickPanels(ray) {
  raycaster.set(ray.origin, ray.direction);
  let best = null, bestDist = Infinity;
  for (const p of panels()) {
    const hit = p.pick(raycaster);
    if (hit) { const d = hit.point.distanceTo(ray.origin); if (d < bestDist) { best = hit; bestDist = d; } }
  }
  return best;
}
function startDraw(id) {
  if (G.state !== 'playing' || !G.loaded || G.drawing) return;
  G.drawing = id; G.drawT = 0;
  elf.setDrawing(true); elf.setDraw(0);
  sfx.drawStart(G.streak);
}
function cancelDraw() { G.drawing = null; elf.setDrawing(false); sfx.drawStop(); }
function releaseDraw(id) {
  if (G.drawing !== id) return;
  G.drawing = null;
  fireArrow();
}
function onPress(id, ray) {
  sfx.ensure();
  if (ray) {
    const hit = pickPanels(ray);
    if (hit && hit.button) return activate(hit.button);
    if (hit && G.state !== 'playing') return;
  }
  if (G.state !== 'playing' && id === 'key') { startRun(); return; }
  startDraw(id);
}

const mouse = new THREE.Vector2();
const mouseRay = () => { raycaster.setFromCamera(mouse, camera); return { origin: raycaster.ray.origin.clone(), direction: raycaster.ray.direction.clone() }; };
const setMouse = (e) => { mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1); };
renderer.domElement.addEventListener('pointerdown', (e) => { if (renderer.xr.isPresenting) return; setMouse(e); onPress('mouse', mouseRay()); });
window.addEventListener('pointerup', () => releaseDraw('mouse'));
renderer.domElement.addEventListener('pointermove', (e) => { setMouse(e); desktopHover = true; });
window.addEventListener('keydown', (e) => {
  if (G.state === 'armory') { if (armory.onKey(e.code)) e.preventDefault(); return; }
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); onPress('key', null); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') releaseDraw('key'); });
window.addEventListener('blur', () => { if (G.drawing) cancelDraw(); });
let desktopHover = false;

// XR controllers / hands. Pinch fires "select" on hand-tracking input sources.
const handFactory = new XRHandModelFactory().setPath('./node_modules/@webxr-input-profiles/assets/dist/profiles/generic-hand/');
const pointers = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  const hand = renderer.xr.getHand(i);
  hand.add(handFactory.createHandModel(hand, 'mesh'));
  const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 6), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.7 }));
  laser.geometry.translate(0, -0.5, 0); laser.geometry.rotateX(Math.PI / 2); laser.visible = false;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  dot.visible = false;
  ctrl.add(laser); scene.add(ctrl, hand, dot);
  const rayOf = () => {
    const o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, -1);
    ctrl.getWorldPosition(o); d.applyQuaternion(ctrl.getWorldQuaternion(new THREE.Quaternion())).normalize();
    return { origin: o, direction: d };
  };
  ctrl.addEventListener('selectstart', () => onPress('xr' + i, rayOf()));
  ctrl.addEventListener('selectend', () => releaseDraw('xr' + i));
  pointers.push({ ctrl, laser, dot, rayOf });
}

function recenter() {
  if (!renderer.xr.isPresenting) return;
  const head = new THREE.Vector3(); camera.getWorldPosition(head);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0;
  if (dir.lengthSq() < 1e-4) return;
  dir.normalize();
  world.rotation.y = Math.atan2(-dir.x, -dir.z);
  world.position.set(head.x, THREE.MathUtils.clamp(head.y - DESIGN_EYE, -0.45, 0.8), head.z);
  world.updateMatrixWorld(true);
}
let recenterIn = 0;
renderer.xr.addEventListener('sessionstart', () => { placeHud(); recenterIn = 40; document.getElementById('hint').style.display = 'none'; });
renderer.xr.addEventListener('sessionend', () => {
  placeHud();
  world.position.set(0, 0, 0); world.rotation.set(0, 0, 0);
  camera.position.copy(DESK_CAM); camera.lookAt(DESK_LOOK);
  document.getElementById('hint').style.display = '';
});

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
const qCam = new THREE.Quaternion(), qWorldInv = new THREE.Quaternion();
let frame = 0, hoverRedraw = 0, ambientAcc = 0, stormT = 5;

function updatePointers() {
  const rays = [];
  if (renderer.xr.isPresenting) {
    for (const p of pointers) {
      const src = p.ctrl.visible;
      p.laser.visible = false; p.dot.visible = false;
      if (!src) continue;
      const ray = p.rayOf();
      const hit = pickPanels(ray);
      if (hit) { p.laser.visible = true; p.laser.scale.z = hit.point.distanceTo(ray.origin); p.dot.visible = true; p.dot.position.copy(hit.point); }
      rays.push(hit);
    }
  } else if (desktopHover) {
    rays.push(pickPanels(mouseRay()));
    renderer.domElement.style.cursor = rays[0] && rays[0].button ? 'pointer' : 'default';
  }
  for (const p of panels()) {
    const h = rays.find((r) => r && r.panel === p && r.button);
    const id = h ? h.button.id : null;
    if (p.hover !== id) { p.hover = id; if (p === menu) flags.menu = true; if (p === hud) flags.hud = true; if (armory && p === armory.panel) armory.dirty = true; }
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  frame++;

  if (recenterIn > 0 && --recenterIn === 0) recenter();

  // pendulum
  pend.amp += (pend.targetAmp - pend.amp) * Math.min(1, dt * 1.5);
  pend.speedMul += ((G.perks.slowT > 0 ? 0.55 : 1) - pend.speedMul) * Math.min(1, dt * 3);
  pend.phase += (Math.PI * 2 / pend.period) * pend.speedMul * dt;
  const cs = Math.cos(pend.phase);
  if (cs * pend.lastCos < 0) { sfx.tick(); if (G.state === 'playing') haptic(0.15, 12); }
  pend.lastCos = cs;
  const cc = cardCenterAt(pend.phase);
  swing.rotation.z = cc.th;
  cardState.shake = Math.max(0, cardState.shake - dt * 2.6);
  cardHolder.rotation.x = Math.sin(t * 60) * cardState.shake * 0.09;
  cardHolder.rotation.z = Math.sin(t * 47) * cardState.shake * 0.05;
  gantry.position.set(Math.sin(t * 71) * cardState.shake * 0.01, 0, 0);
  if (cardState.hidden > 0) {
    cardState.hidden -= dt;
    if (cardState.hidden <= 0) { cardHolder.visible = true; cardHolder.scale.setScalar(0.01); }
  } else if (cardHolder.scale.x < 1) cardHolder.scale.setScalar(Math.min(1, cardHolder.scale.x + dt * 3.5));
  if (cardVisual) cardVisual.userData.spinners.forEach((s, i) => { s.rotation.x += dt * 1.5; s.rotation.y += dt * (1 + i * 0.2); });

  // environment, ambient particles, storm lightning
  scenery.update(dt);
  {
    const env = envFor(G.stage), A = AMBIENT[env.ambient];
    ambientAcc += A.rate * dt;
    while (ambientAcc >= 1) {
      ambientAcc -= 1; const m = A.make();
      particles.spawn({ x: (Math.random() - 0.5) * 18, y: m.high ? 5 + Math.random() * 3 : 0.2 + Math.random() * 3.6, z: -14 + Math.random() * 15, ...m });
    }
    if (env.storm) { stormT -= dt; if (stormT <= 0) { scenery.flash(1); setTimeout(() => { scenery.flash(0.7); }, 140); setTimeout(() => sfx.thunder(), 380); stormT = 4 + Math.random() * 6; } }
  }

  syncUpgradeLook();

  // upgrade orbs
  if (G.state === 'playing') {
    G.perkTimer -= dt;
    if (G.perkTimer <= 0 && perkOrbs.length < 1) { spawnPerk(); G.perkTimer = 8 + Math.random() * 5; }
    if (G.perks.slowT > 0) {
      G.perks.slowT = Math.max(0, G.perks.slowT - dt);
      if (Math.ceil(G.perks.slowT) !== G.slowShown) { G.slowShown = Math.ceil(G.perks.slowT); flags.lives = true; }
      if (frame % 4 === 0) particles.spawn({ x: cc.x + (Math.random() - 0.5) * 1.2, y: cc.y + (Math.random() - 0.5) * 1.6, z: CARD_Z + 0.2, color: 0xc9a8ff, size: 0.06, life: 0.8, vy: 0.3, grav: 0 });
    }
  }
  for (const o of [...perkOrbs]) {
    o.group.visible = G.state === 'playing';
    if (G.state !== 'playing') continue;
    o.t += dt; o.life -= dt;
    o.group.position.set(o.A * Math.sin(o.w * o.t + o.ph), AIM_Y + 0.09 * Math.sin(o.t * 2.3), o.z);
    const pulse = 1 + Math.sin(o.t * 6) * 0.06;
    o.icon.scale.setScalar(0.62 * pulse); o.halo.scale.setScalar(1.0 + Math.sin(o.t * 4) * 0.12);
    const fade = o.life < 2 ? Math.max(0, o.life / 2) : 1;
    o.icon.material.opacity = fade; o.halo.material.opacity = 0.35 * fade;
    if (frame % 5 === 0) particles.spawn({ x: o.group.position.x + (Math.random() - 0.5) * 0.4, y: o.group.position.y + (Math.random() - 0.5) * 0.4, z: o.z, color: PERKS[o.type].hex, size: 0.05, life: 0.6, vy: 0.4, grav: 0 });
    if (o.life <= 0) removePerk(o);
  }

  // egg
  eggFx.wobble = Math.max(0, eggFx.wobble - dt * 0.9);
  eggFx.glow = Math.max(0, eggFx.glow - dt * 1.2);
  eggFx.bounce = Math.max(0, eggFx.bounce - dt * 2.2);
  station.eggPivot.rotation.z = Math.sin(t * 22) * eggFx.wobble;
  station.eggPivot.position.y = AIM_Y + Math.abs(Math.sin(eggFx.bounce * 6)) * 0.08 * eggFx.bounce;
  station.eggMat.emissiveIntensity = eggFx.glow * 1.2;

  // reticle alignment assist
  {
    const c = cardCenterAt(pend.phase);
    const dx = AIM_X - c.x, dy = AIM_Y - c.y, cos = Math.cos(c.th), sin = Math.sin(c.th);
    const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
    const d = Math.hypot(lx / (cardState.hole - 0.02), ly / (cardState.hole * 1.3 - 0.02));
    const col = d < 0.32 ? 0xffe14a : d < 1 ? 0x6dff9a : 0xffffff;
    ringMat.color.setHex(col === 0xffffff && G.perks.steady > 0 ? 0x6dd5ff : col); ringMat.opacity = d < 1 ? 0.95 : 0.5;
    reticle.scale.setScalar((d < 0.32 ? 1.15 + Math.sin(t * 20) * 0.05 : 1) * (G.perks.steady > 0 ? 1.35 : 1));
  }

  // drawing
  if (G.drawing) {
    G.drawT += dt;
    const p = Math.min(1, G.drawT / 0.32);
    elf.setDraw(p); sfx.drawUpdate(p);
  }
  if (!G.loaded) {
    G.reload -= dt;
    if (G.reload <= 0 && G.lives > 0) { G.loaded = true; elf.setLoaded(true); }
  }
  if (G.state !== 'playing' && G.drawing) cancelDraw();

  elf.update(dt, t);

  // arrows
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    if (a.done) continue;
    const prevTip = a.obj.position.z - a.len;
    a.obj.position.z -= a.speed * dt;
    const tip = a.obj.position.z - a.len;
    if (a.style === 'arcane') {
      a.ringT -= dt;
      if (a.ringT <= 0) { a.ringT = 0.05; spawnRing(a.obj.position.z - a.len * 0.5); }
    }
    const tr = a.obj.userData.tier || 0;
    for (let k = 0; k <= tr * 2; k++) {
      particles.spawn({ x: AIM_X + (a.dx || 0) + (Math.random() - 0.5) * 0.05, y: AIM_Y + (Math.random() - 0.5) * 0.05, z: a.obj.position.z + Math.random() * 0.5, color: tr >= 3 ? (Math.random() < 0.5 ? 0x9fe8ff : 0xffffff) : tr === 2 ? (Math.random() < 0.5 ? 0xff6a1a : 0xffd23a) : (a.obj.userData.trail || 0xffffff), size: a.overdrive ? 0.12 : 0.045 + tr * 0.012, life: 0.35 + tr * 0.12, grav: tr === 2 ? -1.2 : 0, vz: 0.5, vy: tr === 3 ? (Math.random() - 0.5) * 2 : 0 });
    }
    for (const o of [...perkOrbs]) { // arrows pick up upgrade orbs they pass through
      const pz = o.group.position.z;
      if (prevTip > pz && tip <= pz && Math.hypot(AIM_X + (a.dx || 0) - o.group.position.x, AIM_Y - o.group.position.y) < o.r + a.radius) collectPerk(o);
    }
    if (prevTip > CARD_Z && tip <= CARD_Z) {
      const frac = (prevTip - CARD_Z) / (prevTip - tip);
      const r = resolveCrossing(a, frac, dt);
      r.gold = a.gold;
      if (a.group) { // triple shot: the best arrow of the volley counts
        a.group.results.push(r);
        if (r.kind === 'miss') { particles.burst(r.pos, 10, { colors: [0xc9a36a], speed: 1.8, size: 0.03, life: 0.5, grav: 6 }); world.remove(a.obj); arrows.splice(i, 1); } else a.hit = true;
        if (a.group.results.length === a.group.n) applyResult(a.group.results.reduce((b, x) => (rankOf(x) > rankOf(b) ? x : b)));
        if (r.kind === 'miss') continue;
      } else {
        if (r.kind === 'miss') { world.remove(a.obj); arrows.splice(i, 1); applyResult(r); continue; }
        a.result = r; a.hit = true; applyResult(r);
      }
    }
    if (a.hit && tip <= EGG_Z + 0.05) { // buried in the hay after threading the card
      a.done = true; a.obj.position.z = EGG_Z + 0.05 + a.len; a.stuckT = 1.4; stuck.push(a);
      arrows.splice(i, 1);
      particles.burst(new THREE.Vector3(AIM_X, AIM_Y, EGG_Z + 0.1), 14, { colors: [0xffe28a, 0xffffff], speed: 1.8, size: 0.04, life: 0.5, grav: 3 });
      continue;
    }
    if (tip < EGG_Z - 3) { world.remove(a.obj); arrows.splice(i, 1); }
  }
  for (let i = stuck.length - 1; i >= 0; i--) {
    stuck[i].stuckT -= dt;
    if (stuck[i].stuckT <= 0) { world.remove(stuck[i].obj); stuck.splice(i, 1); }
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i], u = d.userData;
    u.life -= dt; u.v.y -= 9.8 * dt;
    d.position.addScaledVector(u.v, dt); d.rotation.x += u.r.x * dt; d.rotation.y += u.r.y * dt; d.rotation.z += u.r.z * dt;
    if (d.position.y < 0.05) { d.position.y = 0.05; u.v.multiplyScalar(0.3); u.v.y = 0; }
    if (u.life <= 0) { world.remove(d); d.geometry.dispose(); d.material.dispose(); debris.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.userData.t += dt;
    const k = r.userData.t / 0.5;
    r.scale.setScalar(1 + k * 6); r.material.opacity = Math.max(0, 0.7 * (1 - k));
    if (k >= 1) { world.remove(r); rings.splice(i, 1); }
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const s = popups[i], u = s.userData;
    u.life -= dt;
    const k = 1 - u.life / u.max;
    const pop = k < 0.15 ? 0.5 + (k / 0.15) * 0.6 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
    s.scale.set(1.9 * u.base * pop, 0.475 * u.base * pop, 1);
    s.position.y = u.y0 + k * 0.5;
    s.material.opacity = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
    if (u.life <= 0) { world.remove(s); s.material.map.dispose(); s.material.dispose(); popups.splice(i, 1); }
  }

  // camera shake on desktop only; in VR we shake the scenery slightly instead (comfort)
  camShake = Math.max(0, camShake - dt * 2.2);
  if (!renderer.xr.isPresenting) {
    camera.position.set(DESK_CAM.x + (Math.random() - 0.5) * camShake * 0.05, DESK_CAM.y + (Math.random() - 0.5) * camShake * 0.05, DESK_CAM.z);
  }

  updatePointers();
  if (G.overdrive >= OVERDRIVE_MAX && frame % 6 === 0) flags.lives = true;
  refreshUi();

  world.updateMatrixWorld();
  camera.getWorldQuaternion(qCam);
  qWorldInv.copy(world.quaternion).invert();
  particles.update(dt, qCam.premultiply(qWorldInv));
  renderer.render(scene, camera);
}

function spawnRing(z) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.065, 28), new THREE.MeshBasicMaterial({ color: 0xb98aff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  r.position.set(AIM_X, AIM_Y, z); r.userData = { t: 0 }; world.add(r); rings.push(r);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); placeHud();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const PERK_DESC = {
  triple: 'Your next 3 shots fire 3 arrows at once, and the best one counts.',
  steady: 'The cutout counts as 50% bigger for your next 4 shots.',
  slow: 'The target swings at about half speed for 10 seconds.',
  heart: 'Gain 1 extra arrow, up to a maximum of 5.',
  gold: 'Your next 3 shots pay triple coins, with a golden arrow.',
  charge: 'Adds 3 to your Overdrive meter.',
};
armory = createArmory({
  save, sfx, persist,
  perks: Object.entries(PERKS).map(([id, p]) => ({ id, name: p.name, color: p.color, desc: PERK_DESC[id], icon: perkTexture(id).image })),
  onAction: (id) => activate({ id }),
  getNote: () => menuNote,
  onBack: closeArmory,
  onLayout: () => placeHud(),
});
syncLoadout();
placeHud();
refreshUi(true);
renderer.setAnimationLoop(animate);

// handy for debugging from the console / automated checks
window.__game = { G, save, elf, startRun, fireArrow, pend, cardState, onPress, releaseDraw, activate, camera, loadElfModel, spawnPerk, perkOrbs, applyStage, collectPerk, endRun, armory: () => armory, openArmory };
