// One visual environment per stage (cycles after the last). Colors are hex; scenery lerps toward them.
export const ENVS = [
  { name: 'Training Meadow', top: 0x3d7fd6, mid: 0x9fd0f5, low: 0xfbe3b8, fog: 0xcfe6f7, fogNear: 35, fogFar: 130, ground: 0x5b8f3b, lane: 0xa8845a, leaf: 0x2f6b34, leaf2: 0x3a7a3a, trunk: 0x5d4128, mount: 0x6f86a8, cloud: 0xffffff, cloudOp: 0.85, hemiSky: 0xd6ecff, hemiGround: 0x6b5a3c, hemiI: 1.25, sun: 0xfff0d0, sunI: 2.6, stars: 0, moon: 0, props: [], ambient: 'petals' },
  { name: 'Iron Target Range', top: 0x6f7f95, mid: 0xa9b4c2, low: 0xd9d6cc, fog: 0xaeb6bf, fogNear: 30, fogFar: 110, ground: 0x7d8078, lane: 0x8d8a82, leaf: 0x4d5f4d, leaf2: 0x5b6e5b, trunk: 0x4a4038, mount: 0x6a7078, cloud: 0xdfe3e8, cloudOp: 0.9, hemiSky: 0xcfd8e4, hemiGround: 0x5a5a55, hemiI: 1.1, sun: 0xe6ecf5, sunI: 1.7, stars: 0, moon: 0, props: [], ambient: 'dust' },
  { name: 'Whispering Woods', top: 0x1d4a3a, mid: 0x4f8c6b, low: 0xb9d9a0, fog: 0x6f9a80, fogNear: 8, fogFar: 60, ground: 0x2f6a3a, lane: 0x6f5a3a, leaf: 0x1f5a35, leaf2: 0x2a6f40, trunk: 0x4a3322, mount: 0x3a5a52, cloud: 0xcfe8d8, cloudOp: 0.5, hemiSky: 0xa8d8b8, hemiGround: 0x2a3a22, hemiI: 1.0, sun: 0xcfeeb0, sunI: 1.8, stars: 0, moon: 0, props: [], ambient: 'fireflies' },
  { name: 'Windy Ridge', top: 0x5a4f9a, mid: 0xf0906a, low: 0xffd98a, fog: 0xf2b58c, fogNear: 25, fogFar: 110, ground: 0xa88a46, lane: 0xc29a64, leaf: 0xc2552a, leaf2: 0xd9822e, trunk: 0x5a3a22, mount: 0x8a5a6a, cloud: 0xffc79a, cloudOp: 0.85, hemiSky: 0xffd3a8, hemiGround: 0x7a5a3a, hemiI: 1.1, sun: 0xffa860, sunI: 2.4, stars: 0, moon: 0, props: [], ambient: 'leaves' },
  { name: 'Clockwork Yard', top: 0x4a4a52, mid: 0x8a8478, low: 0xd3b88a, fog: 0x9a9082, fogNear: 20, fogFar: 90, ground: 0x5e5648, lane: 0x7a6a50, leaf: 0x6a5a3a, leaf2: 0x7a6a52, trunk: 0x3a3028, mount: 0x6a6458, cloud: 0xb7ada0, cloudOp: 0.8, hemiSky: 0xd8c9a8, hemiGround: 0x4a3f30, hemiI: 1.15, sun: 0xffd9a0, sunI: 2.0, stars: 0, moon: 0, props: ['gears'], ambient: 'steam' },
  { name: 'Moonlit Archery', top: 0x050a24, mid: 0x142a5a, low: 0x3a5a9a, fog: 0x1a2a50, fogNear: 15, fogFar: 90, ground: 0x1f3a3f, lane: 0x4a4a5a, leaf: 0x143a4a, leaf2: 0x1a4a5a, trunk: 0x2a2a38, mount: 0x24345a, cloud: 0x6a7aa8, cloudOp: 0.45, hemiSky: 0x5a78c8, hemiGround: 0x1a2438, hemiI: 1.0, sun: 0x9fb8ff, sunI: 1.8, stars: 1, moon: 1, props: [], ambient: 'fireflies-blue' },
  { name: "Dragon's Gate", top: 0x2a0808, mid: 0x8a2a14, low: 0xff9a3a, fog: 0x7a2a18, fogNear: 15, fogFar: 85, ground: 0x2c1a14, lane: 0x5a3a2a, leaf: 0x3a1a14, leaf2: 0x5a2214, trunk: 0x1e1410, mount: 0x4a2018, cloud: 0x7a3a28, cloudOp: 0.7, hemiSky: 0xff9a6a, hemiGround: 0x3a1a10, hemiI: 1.05, sun: 0xff7a3a, sunI: 2.2, stars: 0, moon: 0, props: ['lava'], ambient: 'embers' },
  { name: 'Storm Bastion', top: 0x1d2430, mid: 0x3d4a5e, low: 0x6d7c8e, fog: 0x4a5668, fogNear: 12, fogFar: 80, ground: 0x3a4a3a, lane: 0x4a4a48, leaf: 0x2a3d34, leaf2: 0x33493f, trunk: 0x2a2824, mount: 0x3a4254, cloud: 0x56606e, cloudOp: 1, hemiSky: 0x8fa4c4, hemiGround: 0x2a2f38, hemiI: 0.95, sun: 0xbcd0f0, sunI: 1.2, stars: 0, moon: 0, props: [], ambient: 'rain', storm: true },
  { name: 'Crystal Vault', top: 0x2a0f5a, mid: 0x5a2fb0, low: 0x2fd0d0, fog: 0x4a3a9a, fogNear: 15, fogFar: 90, ground: 0x2a1f52, lane: 0x4a3a7a, leaf: 0x20b0a8, leaf2: 0x9a4ad0, trunk: 0x2a2048, mount: 0x4a3a9a, cloud: 0xb08aff, cloudOp: 0.55, hemiSky: 0xb8a0ff, hemiGround: 0x24184a, hemiI: 1.15, sun: 0xd0b0ff, sunI: 2.0, stars: 0.5, moon: 0, props: ['crystals'], ambient: 'sparkles' },
  { name: 'Mythic Range', top: 0xf0c860, mid: 0xffe8b0, low: 0xffffff, fog: 0xfff0cc, fogNear: 30, fogFar: 130, ground: 0xb8c860, lane: 0xf0d9a0, leaf: 0xe0b040, leaf2: 0xf2d070, trunk: 0x8a6a3a, mount: 0xe8d8b0, cloud: 0xffffff, cloudOp: 0.9, hemiSky: 0xfff3d0, hemiGround: 0x9a8a50, hemiI: 1.4, sun: 0xfff0b0, sunI: 3.0, stars: 0, moon: 0, props: ['pillars'], ambient: 'gold' },
];

// ambient particle recipes: rate per second + per-particle factory
const R = Math.random;
export const AMBIENT = {
  petals: { rate: 12, make: () => ({ color: 0xffc6dc, size: 0.06, life: 6, vx: 0.4, vy: -0.1, vz: 0.1, grav: 0.03 }) },
  dust: { rate: 16, make: () => ({ color: 0xe8e8e0, size: 0.04, life: 5, vx: 0.5, vy: 0.05, vz: 0, grav: 0 }) },
  fireflies: { rate: 14, make: () => ({ color: 0xd8ff7a, size: 0.09, life: 4, vx: (R() - 0.5) * 0.4, vy: (R() - 0.5) * 0.3, vz: (R() - 0.5) * 0.4, grav: 0 }) },
  'fireflies-blue': { rate: 14, make: () => ({ color: 0x9fd6ff, size: 0.09, life: 4, vx: (R() - 0.5) * 0.4, vy: (R() - 0.5) * 0.3, vz: (R() - 0.5) * 0.4, grav: 0 }) },
  leaves: { rate: 22, make: () => ({ color: R() < 0.5 ? 0xff8a2a : 0xd2481f, size: 0.09, life: 3.5, vx: 3 + R() * 1.5, vy: R() * 0.8, vz: (R() - 0.5), grav: 0.9 }) },
  steam: { rate: 16, make: () => ({ color: 0x9a9a98, size: 0.3, life: 2.5, vx: 0.2, vy: 0.9, vz: 0, grav: -0.1 }) },
  embers: { rate: 28, make: () => ({ color: R() < 0.5 ? 0xff6a1a : 0xffb03a, size: 0.06, life: 2.6, vx: 0.8, vy: 1.0 + R(), vz: (R() - 0.5) * 0.4, grav: -0.2 }) },
  rain: { rate: 90, make: () => ({ color: 0x9fb8ee, size: 0.035, life: 0.6, vx: -1.5, vy: -14, vz: 0, grav: 0, high: true }) },
  sparkles: { rate: 22, make: () => ({ color: R() < 0.5 ? 0x6ae0ff : 0xe08aff, size: 0.08, life: 3, vx: (R() - 0.5) * 0.3, vy: 0.3 + R() * 0.3, vz: (R() - 0.5) * 0.3, grav: -0.05 }) },
  gold: { rate: 22, make: () => ({ color: 0xffe28a, size: 0.08, life: 3.5, vx: (R() - 0.5) * 0.2, vy: 0.4 + R() * 0.4, vz: (R() - 0.5) * 0.2, grav: -0.05 }) },
};
