import * as THREE from 'three';

// A canvas-textured world-space panel with clickable button rectangles.
// Works with a mouse ray on desktop and with the hand pinch ray in VR.
export class Panel {
  constructor(width, height, pxW, pxH) {
    this.pxW = pxW; this.pxH = pxH;
    this.canvas = document.createElement('canvas');
    this.canvas.width = pxW; this.canvas.height = pxH;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.buttons = [];
    this.hover = null;
    this.dirty = true;
  }

  get object() { return this.mesh; }

  button(id, x, y, w, h, data) { this.buttons.push({ id, x, y, w, h, data }); }

  begin() { this.buttons.length = 0; this.ctx.clearRect(0, 0, this.pxW, this.pxH); return this.ctx; }
  end() { this.texture.needsUpdate = true; this.dirty = false; }

  // Returns the button under a world ray (or null) and the hit point.
  pick(raycaster) {
    if (!this.mesh.visible) return null;
    const hits = raycaster.intersectObject(this.mesh, false);
    if (!hits.length) return null;
    const uv = hits[0].uv;
    const px = uv.x * this.pxW, py = (1 - uv.y) * this.pxH;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return { button: b, point: hits[0].point, panel: this };
    }
    return { button: null, point: hits[0].point, panel: this };
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, { size = 40, color = '#fff', align = 'left', weight = 800, shadow = true, font = 'system-ui, "Segoe UI", sans-serif' } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(str, x + 2, y + 3); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

export function drawCoin(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff2a8'); g.addColorStop(1, '#e0a21a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a5a08'; ctx.lineWidth = r * 0.14; ctx.stroke();
  ctx.fillStyle = '#8a5a08'; ctx.font = `900 ${r * 1.15}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', x, y + r * 0.05);
}

export function drawFlame(ctx, x, y, s, color = '#ff7a1a') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -1);
  ctx.bezierCurveTo(0.9, -0.2, 0.8, 0.9, 0, 1);
  ctx.bezierCurveTo(-0.8, 0.9, -0.9, -0.1, -0.2, -0.5);
  ctx.bezierCurveTo(-0.15, -0.2, 0, -0.3, 0, -1); ctx.fill();
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.moveTo(0, -0.2); ctx.bezierCurveTo(0.45, 0.2, 0.4, 0.8, 0, 0.9); ctx.bezierCurveTo(-0.4, 0.8, -0.4, 0.3, 0, -0.2); ctx.fill();
  ctx.restore();
}

export function drawArrowIcon(ctx, x, y, len, color, broken = false) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'round';
  if (broken) {
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(-4, 0); ctx.moveTo(6, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(10, 10); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2 - 6, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len / 2 + 10, 0); ctx.lineTo(len / 2 - 8, -9); ctx.lineTo(len / 2 - 8, 9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(-len / 2 - 8, -8); ctx.moveTo(-len / 2 + 8, 0); ctx.lineTo(-len / 2, -8); ctx.stroke();
  }
  ctx.restore();
}
