import * as THREE from 'three';
import { Panel, roundRect, text, drawCoin, drawLock, wrapLines } from './panel.js';
import { BOWS, PACKS, OUTFITS, buildBow, buildArrow, decorateArrow } from './weapons.js';
import { buildCard } from './card.js';
import { createElf } from './elf.js';

// The Armory: one big, high-contrast view that shows every collectable (bows, arrow packs + streak arrows, outfits,
// upgrade orbs) as a card with a picture, a clear status label, a description and one large action button.
// Built for accessibility: big text and hit targets, status shown by words/symbols (never color alone),
// keyboard navigation, a text-size toggle and optional spoken descriptions.

export const ARMORY_W = 1280, ARMORY_H = 880;
export const ARMORY_WORLD_W = 1.8;

const TIERS = [
  { key: null, id: 'tier1', name: 'Heating Up', status: 'Earned: streak of 3', desc: 'Hit 3 shots in a row and your arrows glow warm orange.' },
  { key: null, id: 'tier2', name: 'Arrows on Fire', status: 'Earned: streak of 6', desc: 'Hit 6 in a row and your arrows burn with a fire trail.' },
  { key: null, id: 'tier3', name: 'Storm Arrows', status: 'Earned: streak of 10', desc: 'Hit 10 in a row and your arrows crackle with blue lightning.' },
];
const BOW_DESC = {
  elven: 'Carved heartwood longbow. Fires the arrows from your equipped arrow pack.',
  steampunk: 'Brass ballista that fires clockwork bolts and hisses steam when you shoot.',
  laser: 'Sleek crossbow that fires a streak of light.',
  arcane: 'Fires glowing purple arrows that ripple the air as they fly.',
};
const PACK_DESC = {
  medieval: 'A wooden shield target with an iron lock, and heavy broadhead arrows.',
  scifi: 'A floating data-cube target and glowing plasma bolts.',
};

// ---- 3D previews, rendered once to small canvases with a throw-away renderer
function buildPreviews(perks) {
  const out = {};
  let R;
  try { R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch { return out; }
  R.setSize(384, 384); R.setClearColor(0x18224a, 1); // opaque dark backdrop so glows read and the pictures have contrast
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x6677aa, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(2, 3, 4); sc.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const shot = (obj, pad = 1.1) => {
    sc.add(obj);
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 0.5 * pad, dist = r / Math.tan(THREE.MathUtils.degToRad(15));
    cam.position.set(c.x, c.y, c.z + dist); cam.lookAt(c);
    R.render(sc, cam);
    const cv = document.createElement('canvas'); cv.width = cv.height = 384; cv.getContext('2d').drawImage(R.domElement, 0, 0);
    sc.remove(obj); return cv;
  };
  const stringLine = (info) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 4), new THREE.MeshBasicMaterial({ color: info.stringColor }));
    const a = info.tipTop, b = info.tipBot; m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.y = a.distanceTo(b); return m;
  };
  try {
    for (const b of BOWS) {
      const info = buildBow(b.id); const g = new THREE.Group(); g.add(info.root, stringLine(info)); g.rotation.y = -0.9; out['bow:' + b.id] = shot(g, 1.05);
    }
    for (const p of PACKS) {
      const g = new THREE.Group(); const card = buildCard(p.id, 0.25, 0.325); card.scale.setScalar(0.8); g.add(card);
      const arrow = buildArrow(p.id === 'scifi' ? 'plasma' : 'broadhead'); arrow.position.set(0, 0, 0.8); g.add(arrow); g.rotation.y = 0.55; out['pack:' + p.id] = shot(g, 1.05);
    }
    TIERS.forEach((t, i) => {
      const a = decorateArrow(buildArrow('broadhead'), { tier: i + 1 }); const g = new THREE.Group(); g.add(a); a.position.z = 0.35; g.rotation.set(0.35, -1.0, 0.25); out[t.id] = shot(g, 0.62);
    });
    // outfits: the elf herself, standing, facing the viewer
    const prev = createElf(); prev.setBow('elven');
    for (const o of OUTFITS) {
      prev.setOutfit(o); prev.react('happy', 999); prev.update(1, 0); prev.update(1, 0); prev.update(1, 0);
      out['outfit:' + o.id] = shot(prev.group, 1.02);
    }
  } catch (e) { console.warn('armory previews failed:', e); }
  for (const p of perks) out['perk:' + p.id] = p.icon;
  R.dispose(); if (R.forceContextLoss) R.forceContextLoss();
  return out;
}

export function createArmory(cfg) {
  const { save, sfx, persist, perks, onAction, getNote, onBack, onLayout } = cfg;
  const panel = new Panel(ARMORY_WORLD_W, ARMORY_WORLD_W * ARMORY_H / ARMORY_W, ARMORY_W, ARMORY_H);
  panel.mesh.visible = false;
  const S = { tab: 0, sel: 0, dirty: true, note: '' };
  const previews = buildPreviews(perks);
  const ui = () => (save.ui = save.ui || { large: false, voice: false });

  const tabs = [
    { label: 'BOWS', items: () => BOWS.map((b) => shopItem('bow:' + b.id, b.name, BOW_DESC[b.id], b.cost, save.bows.includes(b.id), save.bow === b.id, 'bow:' + b.id)) },
    { label: 'ARROWS', items: () => [
      ...PACKS.map((p) => shopItem('pack:' + p.id, p.name, PACK_DESC[p.id], p.cost, save.packs.includes(p.id), save.pack === p.id, 'pack:' + p.id)),
      ...TIERS.map((t) => ({ key: null, name: t.name, status: t.status, statusKind: 'info', desc: t.desc, preview: t.id })),
    ] },
    { label: 'OUTFITS', items: () => OUTFITS.map((o) => shopItem('outfit:' + o.id, o.name, o.blurb + ' Changes how your elf looks.', o.cost, save.outfits.includes(o.id), save.outfit === o.id, 'outfit:' + o.id)) },
    { label: 'UPGRADES', items: () => perks.map((p) => ({ key: null, name: p.name, status: 'Found while playing', statusKind: 'info', desc: p.desc + ' Shoot the glowing orb as it drifts across the lane.', preview: 'perk:' + p.id, color: p.color })) },
  ];
  function shopItem(key, name, desc, cost, owned, equipped, preview) {
    return { key, name, desc, cost, owned, equipped, preview, statusKind: equipped ? 'equipped' : owned ? 'owned' : 'locked', status: equipped ? 'EQUIPPED' : owned ? 'OWNED' : cost + ' COINS' };
  }
  const items = () => tabs[S.tab].items();
  const current = () => { const it = items(); S.sel = Math.max(0, Math.min(S.sel, it.length - 1)); return it[S.sel]; };

  function speak(str) {
    if (!ui().voice || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(str)); } catch { /* ignore */ }
  }
  function describe(it) {
    const state = it.statusKind === 'equipped' ? 'Equipped.' : it.statusKind === 'owned' ? 'Owned, not equipped.' : it.statusKind === 'locked' ? `Locked. Costs ${it.cost} coins. You have ${save.coins}.` : it.status + '.';
    return `${it.name}. ${state} ${it.desc}`;
  }

  function draw() {
    const c = panel.begin();
    const hv = (id) => panel.hover === id;
    c.fillStyle = 'rgba(6,10,24,0.96)'; roundRect(c, 4, 4, ARMORY_W - 8, ARMORY_H - 8, 44); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 6; c.stroke();

    // header: back, title, coins
    c.fillStyle = hv('arm:back') ? '#ffffff' : 'rgba(255,255,255,0.16)'; roundRect(c, 30, 22, 250, 80, 24); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.stroke();
    text(c, '< BACK', 155, 63, { size: 46, color: hv('arm:back') ? '#0b1226' : '#ffffff', align: 'center', shadow: false });
    panel.button('arm:back', 30, 22, 250, 80);
    text(c, 'ARMORY', ARMORY_W / 2, 62, { size: 70, color: '#ffe9b0', align: 'center' });
    drawCoin(c, 1000, 62, 30); text(c, save.coins.toLocaleString(), 1250, 64, { size: 56, color: '#ffe58a', align: 'right' });

    // tabs
    tabs.forEach((t, i) => {
      const x = 10 + i * 320, y = 118, on = i === S.tab;
      c.fillStyle = on ? '#ffe9b0' : hv('arm:tab:' + i) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'; roundRect(c, x, y, 300, 84, 22); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = on ? 6 : 3; c.stroke();
      text(c, t.label, x + 150, y + 43, { size: 44, color: on ? '#0b1226' : '#ffffff', align: 'center', shadow: false });
      panel.button('arm:tab:' + i, x, y, 300, 84);
    });

    // cards
    const list = items(); const cur = current();
    const cols = list.length <= 4 ? list.length : 3, rows = Math.ceil(list.length / cols);
    const areaX = 10, areaY = 216, areaW = 1260, areaH = 384, gapX = 20, gapY = 16;
    const cw = (areaW - (cols - 1) * gapX) / cols, ch = (areaH - (rows - 1) * gapY) / rows;
    list.forEach((it, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = areaX + col * (cw + gapX), y = areaY + row * (ch + gapY), on = i === S.sel;
      c.fillStyle = on ? 'rgba(255,233,176,0.22)' : hv('arm:card:' + i) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.09)';
      roundRect(c, x, y, cw, ch, 24); c.fill();
      c.strokeStyle = on ? '#ffe9b0' : 'rgba(255,255,255,0.45)'; c.lineWidth = on ? 9 : 3; c.stroke();
      const pv = previews[it.preview];
      const statusColor = it.statusKind === 'equipped' ? '#7dff9a' : it.statusKind === 'locked' ? (save.coins >= it.cost ? '#ffe58a' : '#ffb0b0') : '#cfe8ff';
      if (rows === 1) {
        const ps = Math.min(cw - 30, ch - 140);
        img(c, pv, x + (cw - ps) / 2, y + 12, ps);
        const ns = fit(c, it.name, cw - 24, 38);
        const lines = wrapLines(c, it.name, cw - 24, ns, 800).slice(0, 2);
        lines.forEach((ln, k) => text(c, ln, x + cw / 2, y + ps + 40 + k * 40, { size: ns, align: 'center' }));
        drawStatus(c, it, x + cw / 2, y + ch - 28, 32, statusColor, 'center', cw - 24);
      } else {
        const ps = ch - 24;
        img(c, pv, x + 12, y + 12, ps);
        const tx = x + ps + 28, tw = cw - ps - 40;
        const ns = fit(c, it.name, tw, 34);
        const lines = wrapLines(c, it.name, tw, ns, 800).slice(0, 2);
        lines.forEach((ln, k) => text(c, ln, tx, y + 44 + k * 38, { size: ns }));
        drawStatus(c, it, tx, y + ch - 36, 28, statusColor, 'left', tw);
      }
      if (on) { c.fillStyle = '#ffe9b0'; c.beginPath(); c.moveTo(x + cw / 2 - 16, y + ch + 2); c.lineTo(x + cw / 2 + 16, y + ch + 2); c.lineTo(x + cw / 2, y + ch + 16); c.fill(); }
      panel.button('arm:card:' + i, x, y, cw, ch);
    });

    // details + the one action button
    c.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(c, 10, 616, 1260, 160, 24); c.fill();
    text(c, cur.name, 34, 650, { size: 52, color: '#ffe9b0' });
    const dl = wrapLines(c, cur.desc, 780, 34, 600).slice(0, 3);
    dl.forEach((ln, k) => text(c, ln, 34, 698 + k * 38, { size: 34, weight: 600, shadow: false }));
    const note = S.note;
    if (note) text(c, note, 34, 758, { size: 32, color: '#ffe58a', weight: 700, shadow: false });
    if (cur.key) {
      let label, fill = '#37c75c', dark = true, enabled = true;
      if (cur.statusKind === 'equipped') { label = 'EQUIPPED'; fill = 'rgba(255,255,255,0.18)'; dark = false; enabled = false; }
      else if (cur.statusKind === 'owned') label = 'EQUIP';
      else if (save.coins >= cur.cost) label = `BUY FOR ${cur.cost}`;
      else { label = `NEED ${cur.cost - save.coins} MORE COINS`; fill = '#ffd2a0'; }
      const bx = 840, by = 632, bw = 410, bh = 128;
      c.fillStyle = hv('arm:action') && enabled ? '#ffffff' : fill; roundRect(c, bx, by, bw, bh, 28); c.fill();
      if (!enabled) { c.strokeStyle = '#7dff9a'; c.lineWidth = 5; c.stroke(); }
      const lines = wrapLines(c, label, bw - 30, 44, 800).slice(0, 2);
      lines.forEach((ln, k) => text(c, (!enabled && k === 0 ? '✓ ' : '') + ln, bx + bw / 2, by + bh / 2 + (k - (lines.length - 1) / 2) * 48, { size: 44, color: dark ? '#06240f' : '#7dff9a', align: 'center', shadow: false }));
      if (enabled) panel.button('arm:action', bx, by, bw, bh);
    } else {
      text(c, cur.status, 1050, 696, { size: 36, color: '#cfe8ff', align: 'center', weight: 700 });
    }

    // accessibility row
    const u = ui();
    const toggle = (id, x, w, label) => {
      c.fillStyle = hv(id) ? '#ffffff' : 'rgba(255,255,255,0.16)'; roundRect(c, x, 792, w, 70, 22); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke();
      text(c, label, x + w / 2, 828, { size: 34, color: hv(id) ? '#0b1226' : '#ffffff', align: 'center', shadow: false }); panel.button(id, x, 792, w, 70);
    };
    toggle('arm:text', 30, 440, `TEXT SIZE: ${u.large ? 'LARGE' : 'NORMAL'}`);
    toggle('arm:voice', 490, 400, `VOICE: ${u.voice ? 'ON' : 'OFF'}`);
    text(c, 'Keys: arrows, 1-4, Enter, Esc', 1250, 828, { size: 26, color: '#aac4e6', align: 'right', weight: 600, shadow: false });
    panel.end(); S.dirty = false;
  }
  // shrink a font size until the longest word fits (so names like OVERCHARGE are never cut off)
  function fit(c, str, maxW, size, weight = 800) {
    const longest = str.split(' ').reduce((m, w) => (w.length > m.length ? w : m), '');
    let s = size; c.font = `${weight} ${s}px system-ui`;
    while (s > 22 && c.measureText(longest).width > maxW) { s -= 2; c.font = `${weight} ${s}px system-ui`; }
    return s;
  }
  function img(c, im, x, y, s) { if (!im) return; c.save(); roundRect(c, x, y, s, s, 18); c.clip(); c.drawImage(im, x, y, s, s); c.restore(); }
  function drawStatus(c, it, x, y, size, color, align, maxW = 240) {
    if (it.statusKind === 'locked') {
      const w = (() => { c.font = `800 ${size}px system-ui`; return c.measureText(it.status).width; })();
      const left = align === 'center' ? x - (w + size * 1.2) / 2 : x;
      drawLock(c, left + size * 0.4, y - size * 0.1, size * 1.1, color);
      text(c, it.status, left + size * 1.2, y, { size, color, weight: 800, shadow: false });
    } else {
      const label = (it.statusKind === 'equipped' ? '\u2713 ' : '') + it.status;
      const lines = wrapLines(c, label, maxW, size, 800).slice(0, 2);
      lines.forEach((ln, k) => text(c, ln, x, y - (lines.length - 1 - k) * (size + 4), { size, color, align, weight: 800, shadow: false }));
    }
  }

  function select(i) { S.sel = i; S.note = ''; S.dirty = true; sfx.click(); speak(describe(current())); }
  function handle(id) {
    S.dirty = true;
    if (id === 'arm:back') { sfx.click(); onBack(); return; }
    if (id.startsWith('arm:tab:')) { S.tab = +id.slice(8); S.sel = 0; S.note = ''; sfx.click(); speak(tabs[S.tab].label + '. ' + describe(current())); return; }
    if (id.startsWith('arm:card:')) { select(+id.slice(9)); return; }
    if (id === 'arm:action') { const it = current(); if (it.key) { onAction(it.key); S.note = getNote ? getNote() : ''; speak(S.note); } return; }
    if (id === 'arm:text') { ui().large = !ui().large; persist(); sfx.click(); onLayout(); speak(ui().large ? 'Large text' : 'Normal text'); return; }
    if (id === 'arm:voice') { ui().voice = !ui().voice; persist(); sfx.click(); speak(ui().voice ? 'Voice on' : 'Voice off'); }
  }
  function onKey(code) {
    const n = items().length;
    if (code === 'ArrowRight') select((S.sel + 1) % n);
    else if (code === 'ArrowLeft') select((S.sel - 1 + n) % n);
    else if (code === 'ArrowDown') handle('arm:tab:' + ((S.tab + 1) % tabs.length));
    else if (code === 'ArrowUp') handle('arm:tab:' + ((S.tab - 1 + tabs.length) % tabs.length));
    else if (/^Digit[1-4]$/.test(code)) handle('arm:tab:' + (+code.slice(5) - 1));
    else if (code === 'Enter' || code === 'Space') handle('arm:action');
    else if (code === 'Escape' || code === 'Backspace') handle('arm:back');
    else return false;
    return true;
  }
  function open() { S.dirty = true; S.sel = Math.min(S.sel, items().length - 1); speak('Armory. ' + tabs[S.tab].label + '. ' + describe(current())); }

  return { panel, draw, handle, onKey, open, get dirty() { return S.dirty; }, set dirty(v) { S.dirty = v; } };
}
