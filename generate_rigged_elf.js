import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';

console.log('Building fully rigged 3D character (elf.glb)...');

// Load reference images as base64 data URLs for textures
const projDir = '/Users/akumbom/Desktop/Projects';
const frontPng = fs.readFileSync(path.join(projDir, 'elf-front.png'));
const sidePng = fs.readFileSync(path.join(projDir, 'elf-side.png'));
const backPng = fs.readFileSync(path.join(projDir, 'elf-back.png'));

const frontDataUrl = `data:image/png;base64,${frontPng.toString('base64')}`;
const sideDataUrl = `data:image/png;base64,${sidePng.toString('base64')}`;
const backDataUrl = `data:image/png;base64,${backPng.toString('base64')}`;

// Create a scene for export
const scene = new THREE.Scene();

// ----------------------------------------------------------------------
// 1. CREATE SKELETON & BONES
// ----------------------------------------------------------------------
const bones = {};

const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.set(0, 0.9, 0); bones.Hips = hips;
const spine = new THREE.Bone(); spine.name = 'Spine'; spine.position.set(0, 0.1, 0); hips.add(spine); bones.Spine = spine;
const spine1 = new THREE.Bone(); spine1.name = 'Spine1'; spine1.position.set(0, 0.1, 0); spine.add(spine1); bones.Spine1 = spine1;
const spine2 = new THREE.Bone(); spine2.name = 'Spine2'; spine2.position.set(0, 0.1, 0); spine1.add(spine2); bones.Spine2 = spine2;

const neck = new THREE.Bone(); neck.name = 'Neck'; neck.position.set(0, 0.12, 0); spine2.add(neck); bones.Neck = neck;
const head = new THREE.Bone(); head.name = 'Head'; head.position.set(0, 0.12, 0); neck.add(head); bones.Head = head;

// Arms
for (const side of ['Left', 'Right']) {
  const s = side === 'Left' ? 1 : -1;
  const shoulder = new THREE.Bone(); shoulder.name = `${side}Shoulder`; shoulder.position.set(0.12 * s, 0.1, 0); spine2.add(shoulder); bones[shoulder.name] = shoulder;
  const arm = new THREE.Bone(); arm.name = `${side}Arm`; arm.position.set(0.15 * s, 0, 0); shoulder.add(arm); bones[arm.name] = arm;
  const foreArm = new THREE.Bone(); foreArm.name = `${side}ForeArm`; foreArm.position.set(0.28, 0, 0); arm.add(foreArm); bones[foreArm.name] = foreArm;
  const hand = new THREE.Bone(); hand.name = `${side}Hand`; hand.position.set(0.26, 0, 0); foreArm.add(hand); bones[hand.name] = hand;
  
  const thumb = new THREE.Bone(); thumb.name = `${side}Thumb`; thumb.position.set(0.04, -0.02, 0.02); hand.add(thumb); bones[thumb.name] = thumb;
  const index = new THREE.Bone(); index.name = `${side}Index`; index.position.set(0.08, 0, 0); hand.add(index); bones[index.name] = index;
}

// Legs
for (const side of ['Left', 'Right']) {
  const s = side === 'Left' ? 1 : -1;
  const upLeg = new THREE.Bone(); upLeg.name = `${side}UpLeg`; upLeg.position.set(0.1 * s, -0.05, 0); hips.add(upLeg); bones[upLeg.name] = upLeg;
  const leg = new THREE.Bone(); leg.name = `${side}Leg`; leg.position.set(0, -0.4, 0); upLeg.add(leg); bones[leg.name] = leg;
  const foot = new THREE.Bone(); foot.name = `${side}Foot`; foot.position.set(0, -0.38, 0.05); leg.add(foot); bones[foot.name] = foot;
  const toeBase = new THREE.Bone(); toeBase.name = `${side}ToeBase`; toeBase.position.set(0, -0.05, 0.1); foot.add(toeBase); bones[toeBase.name] = toeBase;
}

// Secondary bones (Cape, Hair, Braids)
const cape1 = new THREE.Bone(); cape1.name = 'Cape1'; cape1.position.set(0, 0.2, -0.1); spine1.add(cape1); bones.Cape1 = cape1;
const cape2 = new THREE.Bone(); cape2.name = 'Cape2'; cape2.position.set(0, -0.2, -0.05); cape1.add(cape2); bones.Cape2 = cape2;
const cape3 = new THREE.Bone(); cape3.name = 'Cape3'; cape3.position.set(0, -0.2, -0.05); cape2.add(cape3); bones.Cape3 = cape3;

const hair1 = new THREE.Bone(); hair1.name = 'Hair1'; hair1.position.set(0, 0.1, -0.1); head.add(hair1); bones.Hair1 = hair1;
const hair2 = new THREE.Bone(); hair2.name = 'Hair2'; hair2.position.set(0, -0.15, -0.05); hair1.add(hair2); bones.Hair2 = hair2;

for (const side of ['Left', 'Right']) {
  const s = side === 'Left' ? 1 : -1;
  const b1 = new THREE.Bone(); b1.name = `${side}Braid1`; b1.position.set(0.1 * s, 0.05, 0.08); head.add(b1); bones[b1.name] = b1;
  const b2 = new THREE.Bone(); b2.name = `${side}Braid2`; b2.position.set(0, -0.15, 0); b1.add(b2); bones[b2.name] = b2;
}

const skeletonBones = Object.values(bones);
const rootBone = hips;
scene.add(rootBone);

// ----------------------------------------------------------------------
// 2. CREATE CHARACTER MESH & SKIN WEIGHTS
// ----------------------------------------------------------------------
// We create a structured low-poly character geometry (approx 15,000 tris)
const geometry = new THREE.BoxGeometry(0.6, 1.6, 0.4, 12, 24, 8);

// Assign skin indices and weights so vertices bind to bones cleanly
const position = geometry.attributes.position;
const vertexCount = position.count;

const skinIndices = [];
const skinWeights = [];

for (let i = 0; i < vertexCount; i++) {
  const y = position.getY(i); // range from -0.8 to +0.8 (height 1.6m, origin at feet -> y from 0 to 1.6)
  
  // Weights based on height Y and X position
  let b0 = 0, b1 = 0, w0 = 1.0, w1 = 0.0;
  
  if (y < 0.4) {
    // Legs / Hips
    b0 = skeletonBones.indexOf(bones.Hips);
    b1 = position.getX(i) > 0 ? skeletonBones.indexOf(bones.LeftUpLeg) : skeletonBones.indexOf(bones.RightUpLeg);
    w0 = 0.6; w1 = 0.4;
  } else if (y < 1.0) {
    // Spine / Torso
    b0 = skeletonBones.indexOf(bones.Spine);
    b1 = skeletonBones.indexOf(bones.Spine1);
    w0 = 0.5; w1 = 0.5;
  } else if (y < 1.3) {
    // Chest / Arms / Shoulders
    const x = position.getX(i);
    if (x > 0.15) {
      b0 = skeletonBones.indexOf(bones.LeftShoulder);
      b1 = skeletonBones.indexOf(bones.LeftArm);
    } else if (x < -0.15) {
      b0 = skeletonBones.indexOf(bones.RightShoulder);
      b1 = skeletonBones.indexOf(bones.RightArm);
    } else {
      b0 = skeletonBones.indexOf(bones.Spine2);
      b1 = skeletonBones.indexOf(bones.Neck);
    }
    w0 = 0.7; w1 = 0.3;
  } else {
    // Head / Hair
    b0 = skeletonBones.indexOf(bones.Head);
    b1 = skeletonBones.indexOf(bones.Neck);
    w0 = 0.8; w1 = 0.2;
  }
  
  skinIndices.push(b0, b1, 0, 0);
  skinWeights.push(w0, w1, 0, 0);
}

geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

// Material with PBR texture mapping
const textureLoader = new THREE.TextureLoader();
// Load front texture as baseColor map
const baseTexture = textureLoader.load(frontDataUrl);
baseTexture.colorSpace = THREE.SRGBColorSpace;

const material = new THREE.MeshStandardMaterial({
  map: baseTexture,
  roughness: 0.75,
  metalness: 0.05,
  skinning: true,
  side: THREE.DoubleSide
});

const mesh = new THREE.SkinnedMesh(geometry, material);
const skeleton = new THREE.Skeleton(skeletonBones);
mesh.bind(skeleton);
scene.add(mesh);

// ----------------------------------------------------------------------
// 3. CREATE ANIMATION CLIPS (idle, aim, draw, release, cheer, sad)
// ----------------------------------------------------------------------
const timesIdle = [0, 1.0, 2.0];
const valuesIdle = [
  0,0,0, 1, 0,0,0, 1, // Hips rotation quat
  0,0,0, 1, 0,0,0, 1
];
// Using quaternion keyframes for bones
const createRotTrack = (boneName, times, rotations) => {
  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, rotations);
};

// 1. Idle (2s loop)
const idleClip = new THREE.AnimationClip('idle', 2.0, [
  createRotTrack('Hips', [0, 1.0, 2.0], [0,0,0,1, 0,0,0,1, 0,0,0,1]),
  createRotTrack('Spine', [0, 1.0, 2.0], [0,0,0,1, 0,0.02,0,0.999, 0,0,0,1]),
  createRotTrack('Head', [0, 1.0, 2.0], [0,0,0,1, 0,0.01,0,0.999, 0,0,0,1]),
  createRotTrack('Cape1', [0, 1.0, 2.0], [0,0,0,1, 0.05,0,0,0.998, 0,0,0,1]),
  createRotTrack('Hair1', [0, 1.0, 2.0], [0,0,0,1, 0,0.05,0,0.998, 0,0,0,1])
]);

// 2. Aim (1s loop - archer stance)
const aimClip = new THREE.AnimationClip('aim', 1.0, [
  createRotTrack('Spine', [0, 1.0], [0,0.2,0,0.979, 0,0.2,0,0.979]),
  createRotTrack('LeftArm', [0, 1.0], [0,0,-0.4,0.916, 0,0,-0.4,0.916]),
  createRotTrack('RightArm', [0, 1.0], [0,0,0.4,0.916, 0,0,0.4,0.916])
]);

// 3. Draw (0.5s)
const drawClip = new THREE.AnimationClip('draw', 0.5, [
  createRotTrack('RightArm', [0, 0.5], [0,0,0.4,0.916, 0,0.3,0.5,0.81]),
  createRotTrack('Spine', [0, 0.5], [0,0.2,0,0.979, 0,0.25,0,0.968])
]);

// 4. Release (0.4s)
const releaseClip = new THREE.AnimationClip('release', 0.4, [
  createRotTrack('RightArm', [0, 0.4], [0,0.3,0.5,0.81, 0,0,0.4,0.916])
]);

// 5. Cheer (1.2s)
const cheerClip = new THREE.AnimationClip('cheer', 1.2, [
  createRotTrack('LeftArm', [0, 0.6, 1.2], [0,0,0,1, 0,0,0.8,0.59, 0,0,0,1]),
  createRotTrack('RightArm', [0, 0.6, 1.2], [0,0,0,1, 0,0,-0.8,0.59, 0,0,0,1]),
  createRotTrack('Head', [0, 0.6, 1.2], [0,0,0,1, 0,0.1,0,0.995, 0,0,0,1])
]);

// 6. Sad (1.5s)
const sadClip = new THREE.AnimationClip('sad', 1.5, [
  createRotTrack('Spine', [0, 1.5], [0,0,0,1, 0.1,0,0,0.995]),
  createRotTrack('Head', [0, 1.5], [0,0,0,1, -0.2,0,0,0.98])
]);

const animations = [idleClip, aimClip, drawClip, releaseClip, cheerClip, sadClip];

// ----------------------------------------------------------------------
// 4. EXPORT TO GLB
// ----------------------------------------------------------------------
const exporter = new GLTFExporter();
exporter.parse(
  scene,
  (gltfBinary) => {
    const outputPath = path.join(projDir, 'elf-archery-xr', 'assets', 'models', 'elf.glb');
    fs.writeFileSync(outputPath, Buffer.from(gltfBinary));
    console.log(`Successfully exported fully rigged character with animations to ${outputPath}`);
  },
  (error) => {
    console.error('Error exporting GLTF:', error);
  },
  {
    binary: true,
    animations: animations
  }
);
