import * as THREE from 'three';

// The swinging target card. Origin = centre of the egg-shaped cutout.
// medieval: engraved wooden shield with iron rim + lock. scifi: floating data-cube.
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });

function holePath(a, b) {
  const p = new THREE.Path();
  p.absellipse(0, 0, a, b, 0, Math.PI * 2, true, 0);
  return p;
}

function shieldShape(s, a, b) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.62 * s, 0.8 * s);
  sh.lineTo(0.62 * s, 0.8 * s);
  sh.lineTo(0.62 * s, -0.1 * s);
  sh.bezierCurveTo(0.62 * s, -0.6 * s, 0.25 * s, -0.9 * s, 0, -1.05 * s);
  sh.bezierCurveTo(-0.25 * s, -0.9 * s, -0.62 * s, -0.6 * s, -0.62 * s, -0.1 * s);
  sh.closePath();
  sh.holes.push(holePath(a, b));
  return sh;
}

function cubeShape(a, b) {
  const sh = new THREE.Shape(); const x = 0.62, y0 = -0.85, y1 = 0.75, r = 0.09;
  sh.moveTo(-x + r, y0); sh.lineTo(x - r, y0); sh.quadraticCurveTo(x, y0, x, y0 + r);
  sh.lineTo(x, y1 - r); sh.quadraticCurveTo(x, y1, x - r, y1);
  sh.lineTo(-x + r, y1); sh.quadraticCurveTo(-x, y1, -x, y1 - r);
  sh.lineTo(-x, y0 + r); sh.quadraticCurveTo(-x, y0, -x + r, y0);
  sh.holes.push(holePath(a, b));
  return sh;
}

const extrude = (shape, depth) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 });
  g.translate(0, 0, -depth / 2); return g;
};

export function buildCard(pack, a, b) {
  const group = new THREE.Group();
  const spinners = [];
  let topY = 0.8;
  const rim = (color, glowy) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(a + 0.012, 0.014, 8, 40),
      glowy ? new THREE.MeshBasicMaterial({ color }) : std(color, { metalness: 0.8, roughness: 0.35 }));
    t.scale.y = b / a; return t;
  };

  if (pack === 'scifi') {
    topY = 0.75;
    const body = new THREE.Mesh(extrude(cubeShape(a, b), 0.16), std(0x0d2038, { emissive: 0x0a3a66, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.35 }));
    group.add(body);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry, 25), new THREE.LineBasicMaterial({ color: 0x4deaff }));
    group.add(edges);
    const r1 = rim(0x4deaff, true); r1.position.z = 0.085; group.add(r1);
    const r2 = rim(0x4deaff, true); r2.position.z = -0.085; group.add(r2);
    // data glyph bars
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1 + (i % 2) * 0.18, 0.025, 0.01), new THREE.MeshBasicMaterial({ color: 0x4deaff, transparent: true, opacity: 0.8 }));
      bar.position.set(-0.3 + (i % 2) * 0.1, 0.52 - i * 0.07, 0.09); group.add(bar);
      const bar2 = bar.clone(); bar2.position.z = -0.09; group.add(bar2);
    }
    for (const [x, y] of [[-0.62, 0.75], [0.62, 0.75], [-0.62, -0.85], [0.62, -0.85]]) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: 0x8ff3ff }));
      c.position.set(x, y, 0); group.add(c); spinners.push(c);
    }
    group.userData.debris = [0x0d2038, 0x4deaff, 0x1b5a9a];
  } else {
    topY = 0.8;
    const iron = new THREE.Mesh(extrude(shieldShape(1, a, b), 0.12), std(0x5b6169, { metalness: 0.85, roughness: 0.4 }));
    group.add(iron);
    const wood = new THREE.Mesh(extrude(shieldShape(0.88, a, b), 0.15), std(0x8a5a2e, { roughness: 0.85 }));
    group.add(wood);
    // engraved planks
    for (const x of [-0.3, 0.3]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.3, 0.01), std(0x5a3818)); line.position.set(x, -0.05, 0.078); group.add(line);
      const l2 = line.clone(); l2.position.z = -0.078; group.add(l2);
    }
    const r1 = rim(0x8a9099, false); r1.position.z = 0.07; group.add(r1);
    const r2 = rim(0x8a9099, false); r2.position.z = -0.07; group.add(r2);
    for (const [x, y] of [[-0.5, 0.68], [0.5, 0.68], [-0.5, -0.3], [0.5, -0.3], [0, -0.85]]) { // rivets
      for (const z of [0.08, -0.08]) { const rv = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0xb9bec6, { metalness: 0.9, roughness: 0.3 })); rv.position.set(x, y, z); group.add(rv); }
    }
    // iron lock engraving above the cutout
    const lockMat = std(0x3d4248, { metalness: 0.9, roughness: 0.4 });
    for (const z of [0.082, -0.082]) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.02), lockMat); body.position.set(0, 0.5, z); group.add(body);
      const sh = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), lockMat); sh.position.set(0, 0.56, z); group.add(sh);
    }
    group.userData.debris = [0x8a5a2e, 0x5b6169, 0x5a3818];
  }
  group.userData.topY = topY;
  group.userData.spinners = spinners;
  return group;
}

export function buildChain(maxLinks = 60) {
  const mesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.03, 0.008, 6, 10), new THREE.MeshStandardMaterial({ color: 0x555b63, metalness: 0.85, roughness: 0.4 }), maxLinks);
  mesh.frustumCulled = false;
  return mesh;
}

export function layoutChain(mesh, length) {
  const step = 0.075, n = Math.min(mesh.instanceMatrix.count, Math.ceil(length / step));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(0.8, 1.35, 1);
  for (let i = 0; i < n; i++) {
    q.setFromEuler(new THREE.Euler(0, (i % 2) * Math.PI / 2, 0));
    p.set(0, -(i + 0.5) * step, 0); m.compose(p, q, s); mesh.setMatrixAt(i, m);
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
}
