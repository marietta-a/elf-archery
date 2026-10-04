import * as THREE from 'three';

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// One InstancedMesh of camera-facing quads: cheap enough for Quest, additive so fading = darkening.
export class Particles {
  constructor(max = 700) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: softDot(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      max,
    );
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const f = () => new Float32Array(max);
    Object.assign(this, { x: f(), y: f(), z: f(), vx: f(), vy: f(), vz: f(), life: f(), maxLife: f(), size: f(), r: f(), g: f(), b: f(), grav: f(), drag: f(), mode: f(), cx: f(), cy: f(), cz: f(), ang: f(), rad: f(), spin: f() });
    this.cursor = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._c = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, zero);
  }

  _alloc() {
    for (let n = 0; n < this.max; n++) {
      const i = (this.cursor + n) % this.max;
      if (this.life[i] <= 0) { this.cursor = (i + 1) % this.max; return i; }
    }
    return -1;
  }

  spawn(o) {
    const i = this._alloc(); if (i < 0) return;
    const c = this._c.set(o.color ?? 0xffffff);
    this.x[i] = o.x; this.y[i] = o.y; this.z[i] = o.z;
    this.vx[i] = o.vx ?? 0; this.vy[i] = o.vy ?? 0; this.vz[i] = o.vz ?? 0;
    this.life[i] = this.maxLife[i] = o.life ?? 1; this.size[i] = o.size ?? 0.06;
    this.r[i] = c.r; this.g[i] = c.g; this.b[i] = c.b;
    this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0; this.mode[i] = o.mode ?? 0;
    this.cx[i] = o.cx ?? 0; this.cy[i] = o.cy ?? 0; this.cz[i] = o.cz ?? 0;
    this.ang[i] = o.ang ?? 0; this.rad[i] = o.rad ?? 0; this.spin[i] = o.spin ?? 0;
  }

  burst(p, count, { colors = [0xffffff], speed = 2, up = 0, size = 0.06, life = 0.9, grav = 4, drag = 0.8, dirZ = 0 } = {}) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), s = speed * (0.35 + Math.random() * 0.65);
      this.spawn({
        x: p.x, y: p.y, z: p.z,
        vx: Math.sin(b) * Math.cos(a) * s, vy: Math.sin(b) * Math.sin(a) * s + up, vz: Math.cos(b) * s + dirZ,
        color: colors[(Math.random() * colors.length) | 0], life: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), grav, drag,
      });
    }
  }

  // swirl pulled through a hole centred at c, travelling toward -z
  vortex(c, count = 70, color = 0x9fe8ff) {
    for (let k = 0; k < count; k++) {
      this.spawn({ mode: 1, cx: c.x, cy: c.y, cz: c.z, ang: Math.random() * Math.PI * 2, rad: 0.45 + Math.random() * 0.35, x: c.x, y: c.y, z: c.z + 0.9 + Math.random() * 0.5,
        vz: -(3 + Math.random() * 2), spin: 9 + Math.random() * 5, life: 0.55 + Math.random() * 0.35, size: 0.05 + Math.random() * 0.04, color });
    }
  }

  update(dt, camQuat) {
    const m = this._m, q = camQuat, s = this._s, p = this._p;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, m); continue; }
      const k = this.life[i] / this.maxLife[i];
      if (this.mode[i] === 1) {
        this.ang[i] += this.spin[i] * dt;
        this.rad[i] *= Math.pow(0.04, dt);
        this.z[i] += this.vz[i] * dt;
        this.x[i] = this.cx[i] + Math.cos(this.ang[i]) * this.rad[i];
        this.y[i] = this.cy[i] + Math.sin(this.ang[i]) * this.rad[i];
      } else {
        const d = Math.max(0, 1 - this.drag[i] * dt);
        this.vx[i] *= d; this.vy[i] = this.vy[i] * d - this.grav[i] * dt; this.vz[i] *= d;
        this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      }
      const sz = this.size[i] * (0.4 + 0.6 * k);
      p.set(this.x[i], this.y[i], this.z[i]); s.set(sz, sz, sz);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
      const f = Math.min(1, k * 1.6);
      this.mesh.instanceColor.setXYZ(i, this.r[i] * f, this.g[i] * f, this.b[i] * f);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
