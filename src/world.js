import * as THREE from 'three';

// Static scenery + the target gantry geometry. Everything is cheap (flat shading, instancing).
export const AIM_X = 0;
export const AIM_Y = 0.72;
export const ELF_Z = -1.1;
export const CARD_Z = -9;
export const EGG_Z = -9.6;
export const PEND_L = 4.2;
export const PIVOT_Y = AIM_Y + PEND_L;

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, ...o });
const rand = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export function buildScenery(scene) {
  const g = new THREE.Group();

  // sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(150, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3d7fd6) }, mid: { value: new THREE.Color(0x9fd0f5) }, low: { value: new THREE.Color(0xfbe3b8) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(low, mid, smoothstep(-0.05, 0.25, h)); c = mix(c, top, smoothstep(0.2, 0.85, h)); gl_FragColor = vec4(c, 1.0); }',
    }),
  );
  g.add(sky);
  scene.fog = new THREE.Fog(0xcfe6f7, 35, 130);

  // ground + shooting lane
  const ground = new THREE.Mesh(new THREE.CircleGeometry(130, 40), std(0x5b8f3b, { flatShading: false }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 16), std(0xa8845a, { flatShading: false }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.01, -5.5); g.add(lane);
  for (let i = 0; i < 6; i++) { // distance stones
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.2), std(0x8d8f93)); s.position.set(1.95, 0.03, -2 - i * 1.6); g.add(s);
  }
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.06, 20), std(0x6e7176)); plinth.position.set(0, 0.03, ELF_Z); g.add(plinth);

  // trees + rocks (instanced)
  const r = rand(7);
  const N = 70;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6), std(0x5d4128), N);
  const leaf = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.2, 7), std(0x2f6b34), N);
  const leaf2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 3.2, 7), std(0x3a7a3a), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    let x, z;
    do { const a = r() * Math.PI * 2, d = 12 + r() * 60; x = Math.cos(a) * d; z = Math.sin(a) * d - 6; } while (Math.abs(x) < 7 && z > -16 && z < 5);
    const s = 0.8 + r() * 1.1;
    sc.set(s, s, s);
    p.set(x, 0.8 * s, z); m4.compose(p, q, sc); trunk.setMatrixAt(i, m4);
    p.set(x, 3.2 * s, z); m4.compose(p, q, sc); leaf.setMatrixAt(i, m4);
    p.set(x, 5.2 * s, z); m4.compose(p, q, sc); leaf2.setMatrixAt(i, m4);
  }
  g.add(trunk, leaf, leaf2);

  // far mountains
  const mt = std(0x6f86a8);
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI * 0.9 + (i / 9) * Math.PI * 0.8 - Math.PI / 2 + Math.PI / 2;
    const h = 22 + r() * 22, w = 16 + r() * 14;
    const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6), mt);
    m.position.set(Math.sin(a) * 100, h / 2 - 1, -Math.abs(Math.cos(a)) * 100 - 20); g.add(m);
  }
  // soft clouds
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(4 + r() * 3, 8, 6), cm); b.position.set(k * 5 - 8, r() * 2, r() * 3); b.scale.y = 0.55; c.add(b); }
    c.position.set(-80 + i * 22, 38 + r() * 14, -70 - r() * 40); g.add(c);
  }

  // lights
  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x6b5a3c, 1.25); g.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(6, 12, 5); g.add(sun);

  // ---- environment props (rise out of the ground when their stage is active)
  const props = {};
  const propGroup = (name) => { const p = new THREE.Group(); p.visible = false; p.position.y = -10; p.userData.t = 0; g.add(p); props[name] = p; return p; };
  const edge = () => { const side = r() < 0.5 ? -1 : 1; return [side * (5 + r() * 14), -34 + r() * 36]; };
  {
    const p = propGroup('crystals');
    const cols = [0x6ae0ff, 0xc06aff, 0xff6ad8];
    for (let i = 0; i < 18; i++) {
      const [x, z] = edge(); const h = 1 + r() * 2.2;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: cols[i % 3], emissive: cols[i % 3], emissiveIntensity: 0.9, roughness: 0.2, flatShading: true }));
      c.scale.set(0.7, h, 0.7); c.position.set(x, h * 0.6, z); c.rotation.y = r() * 3; p.add(c);
    }
  }
  const gears = [];
  {
    const p = propGroup('gears');
    const brass = std(0xb8893a, { metalness: 0.7, roughness: 0.5 }), iron = std(0x4a4f57, { metalness: 0.7, roughness: 0.5 });
    for (let i = 0; i < 7; i++) {
      const [x, z] = edge(); const R = 1.2 + r() * 1.6;
      const gear = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.35, 14), i % 2 ? brass : iron); body.rotation.z = Math.PI / 2; gear.add(body);
      for (let k = 0; k < 12; k++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), i % 2 ? brass : iron);
        const a = (k / 12) * Math.PI * 2; t.position.set(0, Math.cos(a) * (R + 0.15), Math.sin(a) * (R + 0.15)); t.rotation.x = a; gear.add(t);
      }
      gear.position.set(x, R + 0.1, z); gear.userData.spin = (i % 2 ? 1 : -1) * (0.15 + r() * 0.25); p.add(gear); gears.push(gear);
    }
  }
  {
    const p = propGroup('lava');
    for (let i = 0; i < 9; i++) {
      const [x, z] = edge();
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.5 + r() * 2.5, 18), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff6a1a : 0xff9a2a }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.04, z); p.add(pool);
    }
    const volcano = new THREE.Mesh(new THREE.ConeGeometry(26, 30, 9), std(0x2a1812)); volcano.position.set(-30, 12, -95); p.add(volcano);
    const crater = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 9), new THREE.MeshBasicMaterial({ color: 0xff7a2a, fog: false })); crater.position.set(-30, 27.5, -95); p.add(crater);
  }
  {
    const p = propGroup('pillars');
    for (let i = 0; i < 7; i++) {
      const [x, z] = edge();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 70, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      col.position.set(x * 2.2, 30, z - 20); p.add(col);
    }
  }
  // stars + moon
  const starPos = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const a = r() * Math.PI * 2, e = 0.1 + r() * 1.3, d = 140;
    starPos.set([Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d], i * 3);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  g.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0, fog: false }));
  moon.position.set(-45, 62, -115); g.add(moon);

  // ---- smooth transitions between environments
  const colorKeys = {
    top: sky.material.uniforms.top.value, mid: sky.material.uniforms.mid.value, low: sky.material.uniforms.low.value,
    fog: scene.fog.color, ground: ground.material.color, lane: lane.material.color, leaf: leaf.material.color, leaf2: leaf2.material.color,
    trunk: trunk.material.color, mount: mt.color, cloud: cm.color, hemiSky: hemi.color, hemiGround: hemi.groundColor, sun: sun.color,
  };
  const num = { fogNear: scene.fog.near, fogFar: scene.fog.far, hemiI: 1.25, sunI: 2.6, cloudOp: 0.85, stars: 0, moon: 0 };
  let env = null, flashV = 0;
  const tmp = new THREE.Color();
  function setEnv(e, snap = false) {
    env = e;
    if (snap) { update(10); for (const k in props) { props[k].userData.t = e.props.includes(k) ? 1 : 0; } }
  }
  function update(dt) {
    if (!env) return;
    const f = 1 - Math.exp(-dt * 1.4);
    for (const k in colorKeys) colorKeys[k].lerp(tmp.set(env[k]), f);
    for (const k in num) num[k] += (env[k] - num[k]) * f;
    scene.fog.near = num.fogNear; scene.fog.far = num.fogFar;
    flashV = Math.max(0, flashV - dt * 5);
    hemi.intensity = num.hemiI + flashV * 3; sun.intensity = num.sunI + flashV * 4;
    cm.opacity = num.cloudOp;
    stars.material.opacity = num.stars; stars.visible = num.stars > 0.01;
    moon.material.opacity = num.moon; moon.visible = num.moon > 0.01;
    for (const k in props) {
      const p = props[k], want = env.props.includes(k) ? 1 : 0;
      p.userData.t += (want - p.userData.t) * Math.min(1, dt * 1.5);
      p.visible = p.userData.t > 0.02;
      p.position.y = -(1 - p.userData.t) * 12;
    }
    gears.forEach((gr) => { gr.rotation.x += gr.userData.spin * dt; });
  }
  return { group: g, setEnv, update, flash: (v = 1) => { flashV = v; } };
}

// Gantry posts and beam. The pendulum hangs from PIVOT_Y.
export function buildGantry() {
  const g = new THREE.Group();
  const wood = std(0x6a4a2c), iron = std(0x40454d, { metalness: 0.7, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, 5.5, 0.34), wood); post.position.set(3.4 * s, 2.75, CARD_Z); g.add(post);
    for (const y of [0.6, 2.2, 4.4]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), iron); band.position.set(3.4 * s, y, CARD_Z); g.add(band); }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), wood); brace.position.set(3.0 * s, 4.7, CARD_Z); brace.rotation.z = 0.8 * s; g.add(brace);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.34, 0.34), wood); beam.position.set(0, 5.45, CARD_Z); g.add(beam);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.4), iron); bracket.position.set(0, PIVOT_Y + 0.3, CARD_Z); g.add(bracket);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), iron); hub.position.set(0, PIVOT_Y, CARD_Z); g.add(hub);
  return g;
}

export function buildEggStation() {
  const g = new THREE.Group();
  const stone = std(0x77797e);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.46, 10), stone); stand.position.set(0, 0.23, EGG_Z); g.add(stand);
  const nest = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 14), std(0x8a6a3a)); nest.rotation.x = Math.PI / 2; nest.position.set(0, 0.5, EGG_Z); g.add(nest);
  const hay = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 0.7), std(0xcaa84a)); hay.position.set(0, 0.85, EGG_Z - 0.55); g.add(hay);
  for (let i = 0; i < 5; i++) { // straw bands
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.05, 0.74), std(0x7a5b2a)); b.position.set(0, 0.2 + i * 0.35, EGG_Z - 0.55); g.add(b);
  }
  const eggPivot = new THREE.Group(); eggPivot.position.set(AIM_X, AIM_Y, EGG_Z); g.add(eggPivot);
  const eggMat = new THREE.MeshStandardMaterial({ color: 0xf5ecd4, roughness: 0.45, emissive: 0xffc24a, emissiveIntensity: 0 });
  const egg = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), eggMat); egg.scale.set(0.15, 0.2, 0.15); eggPivot.add(egg);
  const spotMat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.8 });
  [[0.5, 0.3, 0.8], [-0.6, -0.1, 0.78], [0.2, -0.5, 0.84], [-0.2, 0.62, 0.75], [0.7, -0.25, 0.65]].forEach(([x, y, z]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), spotMat);
    const v = new THREE.Vector3(x, y, z).normalize(); s.position.set(v.x * 0.15, v.y * 0.2, v.z * 0.15); eggPivot.add(s);
  });
  return { group: g, eggPivot, eggMat };
}
