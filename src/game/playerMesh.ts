import * as THREE from 'three';
import { PlayerData, TeamType } from '../types/football';

export interface PlayerMeshInstance {
  group: THREE.Group;
  updateAnimation: (player: PlayerData, delta: number, isControlled: boolean) => void;
  selectionRing: THREE.Mesh;
  haloGlow: THREE.Mesh;
  data: PlayerData;
}

// Procedural jersey canvas texture with squad number and team stripes
function createJerseyTexture(team: TeamType, number: number, isGK: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (isGK) {
    // Goalkeeper kit: bright neon lime or neon orange/violet
    ctx.fillStyle = team === 'NEWGEN' ? '#10b981' : '#f59e0b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, 256, 40);
  } else if (team === 'NEWGEN') {
    // NEWGEN: Royal Blue & Electric Cyan stripes
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#38bdf8';
    for (let x = 32; x < 256; x += 64) {
      ctx.fillRect(x, 0, 32, 256);
    }
  } else {
    // NEWEGOISTS: Crimson Red & Jet Black / Gold accents
    ctx.fillStyle = '#be123c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#1c1917';
    for (let x = 32; x < 256; x += 64) {
      ctx.fillRect(x, 0, 32, 256);
    }
  }

  // Chest Logo / Ego Symbol
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(80, 80, 16, 0, Math.PI * 2);
  ctx.fill();

  // Back Squad Number
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.font = 'bold 110px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(`${number}`, 128, 140);
  ctx.fillText(`${number}`, 128, 140);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPlayerMesh(player: PlayerData): PlayerMeshInstance {
  const root = new THREE.Group();
  root.name = `Player_${player.team}_${player.id}`;
  root.position.set(player.x, player.y, player.z);

  const isGK = player.isGoalkeeper;
  const jerseyTex = createJerseyTexture(player.team, player.number, isGK);

  // Materials
  const jerseyMat = new THREE.MeshStandardMaterial({
    map: jerseyTex,
    roughness: 0.65,
    metalness: 0.1,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: player.skinTone || '#dfad87',
    roughness: 0.8,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: player.hairColor || '#18181b',
    roughness: 0.9,
  });

  const shortsColor = isGK
    ? (player.team === 'NEWGEN' ? 0x064e3b : 0x78350f)
    : (player.team === 'NEWGEN' ? 0xffffff : 0x0f172a);

  const shortsMat = new THREE.MeshStandardMaterial({
    color: shortsColor,
    roughness: 0.7,
  });

  const sockColor = player.team === 'NEWGEN' ? 0x38bdf8 : 0x991b1b;
  const sockMat = new THREE.MeshStandardMaterial({
    color: isGK ? 0x222222 : sockColor,
    roughness: 0.7,
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.4,
    metalness: 0.2,
  });

  // 1. Torso & Chest
  const torsoGeo = new THREE.BoxGeometry(0.7, 0.8, 0.38);
  const torso = new THREE.Mesh(torsoGeo, jerseyMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  torso.receiveShadow = true;
  root.add(torso);

  // 2. Neck & Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.85, 0);

  const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Hair style
  const hairGeo = new THREE.SphereGeometry(0.25, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.y = 0.05;
  headGroup.add(hair);

  // Visor / Ego Eyes or Headband
  const bandGeo = new THREE.CylinderGeometry(0.245, 0.245, 0.06, 16);
  const bandMat = new THREE.MeshStandardMaterial({
    color: player.team === 'NEWGEN' ? 0x00f2fe : 0xff0055,
    emissive: player.team === 'NEWGEN' ? 0x00f2fe : 0xff0055,
    emissiveIntensity: 0.4,
  });
  const headband = new THREE.Mesh(bandGeo, bandMat);
  headband.position.y = 0.04;
  headGroup.add(headband);

  root.add(headGroup);

  // 3. Arms (Pivoting at shoulders)
  const armGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.65, 8);
  armGeo.translate(0, -0.32, 0); // pivot at top

  // Left Arm
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.43, 1.7, 0);
  const leftArmMesh = new THREE.Mesh(armGeo, skinMat);
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);
  root.add(leftArmPivot);

  // Right Arm
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.43, 1.7, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, skinMat);
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);
  root.add(rightArmPivot);

  // 4. Pelvis / Shorts
  const shortsGeo = new THREE.BoxGeometry(0.68, 0.35, 0.36);
  const shorts = new THREE.Mesh(shortsGeo, shortsMat);
  shorts.position.y = 0.88;
  shorts.castShadow = true;
  root.add(shorts);

  // 5. Left Leg (Pivot at hip)
  const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.8, 8);
  legGeo.translate(0, -0.4, 0); // pivot at hip

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.2, 0.82, 0);
  const leftLegMesh = new THREE.Mesh(legGeo, sockMat);
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);

  // Left Boot
  const bootGeo = new THREE.BoxGeometry(0.14, 0.12, 0.28);
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.76, 0.06);
  leftLegPivot.add(leftBoot);
  root.add(leftLegPivot);

  // 6. Right Leg (Pivot at hip)
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.2, 0.82, 0);
  const rightLegMesh = new THREE.Mesh(legGeo, sockMat);
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);

  // Right Boot
  const rightBoot = new THREE.Mesh(bootGeo, bootMat);
  rightBoot.position.set(0, -0.76, 0.06);
  rightLegPivot.add(rightBoot);
  root.add(rightLegPivot);

  // 7. Ground Contact Shadow
  const shadowGeo = new THREE.CircleGeometry(0.45, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  // 8. Controlled Player Overhead Marker (Golden/Cyan Holographic Ring)
  const ringGeo = new THREE.RingGeometry(0.65, 0.85, 24);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const selectionRing = new THREE.Mesh(ringGeo, ringMat);
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.03;
  selectionRing.visible = false;
  root.add(selectionRing);

  // Floating Overhead Triangle Marker
  const coneGeo = new THREE.ConeGeometry(0.22, 0.4, 4);
  coneGeo.rotateX(Math.PI); // point downwards
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
  });
  const haloGlow = new THREE.Mesh(coneGeo, coneMat);
  haloGlow.position.set(0, 2.5, 0);
  haloGlow.visible = false;
  root.add(haloGlow);

  // Animation Update function
  const updateAnimation = (p: PlayerData, delta: number, isControlled: boolean) => {
    // Sync position
    root.position.x = p.x;
    root.position.z = p.z;
    root.rotation.y = p.rotation;

    // Controlled indicators
    selectionRing.visible = isControlled;
    haloGlow.visible = isControlled;

    if (isControlled) {
      haloGlow.position.y = 2.45 + Math.sin(p.animTime * 6) * 0.12;
      haloGlow.rotation.y += delta * 3;
      selectionRing.scale.setScalar(1 + Math.sin(p.animTime * 4) * 0.08);
    }

    const moveSpeed = Math.hypot(p.vx, p.vz);

    if (p.state === 'kicking') {
      // Power kick swing: right leg kicks forward, left arm swings back
      const kickProgress = Math.min(1, p.animTime * 6);
      rightLegPivot.rotation.x = -1.2 + kickProgress * 2.2;
      leftLegPivot.rotation.x = 0.2;
      leftArmPivot.rotation.x = -0.8;
      rightArmPivot.rotation.x = 0.6;
      torso.rotation.x = -0.2;
    } else if (p.state === 'tackling') {
      // Slide tackle pose
      leftLegPivot.rotation.x = 1.3;
      rightLegPivot.rotation.x = -0.4;
      leftArmPivot.rotation.x = -1.0;
      rightArmPivot.rotation.x = -1.0;
      torso.position.y = 0.8;
      torso.rotation.x = 0.5;
    } else if (p.isGoalkeeper && moveSpeed < 0.2) {
      // Goalkeeper ready crouch stance
      torso.position.y = 1.25;
      torso.rotation.x = 0.2;
      leftLegPivot.rotation.x = -0.25;
      rightLegPivot.rotation.x = -0.25;
      leftArmPivot.rotation.z = 0.45;
      rightArmPivot.rotation.z = -0.45;
      leftArmPivot.rotation.x = 0.3;
      rightArmPivot.rotation.x = 0.3;
    } else if (moveSpeed > 0.1) {
      // Running / sprinting cycle
      const animFreq = moveSpeed * 3.8;
      const legSwing = Math.sin(p.animTime * animFreq) * 0.75;
      leftLegPivot.rotation.x = legSwing;
      rightLegPivot.rotation.x = -legSwing;

      // Opposing arm swing
      leftArmPivot.rotation.x = -legSwing * 0.85;
      rightArmPivot.rotation.x = legSwing * 0.85;
      leftArmPivot.rotation.z = 0.15;
      rightArmPivot.rotation.z = -0.15;

      // Torso slight forward lean
      torso.position.y = 1.35 + Math.abs(Math.sin(p.animTime * animFreq * 2)) * 0.06;
      torso.rotation.x = 0.15;
      torso.rotation.z = Math.sin(p.animTime * animFreq) * 0.05;
    } else {
      // Idle breathing stance
      const breath = Math.sin(p.animTime * 2.2) * 0.02;
      torso.position.y = 1.35 + breath;
      torso.rotation.x = 0;
      torso.rotation.z = 0;
      leftLegPivot.rotation.x = 0;
      rightLegPivot.rotation.x = 0;
      leftArmPivot.rotation.x = 0;
      rightArmPivot.rotation.x = 0;
      leftArmPivot.rotation.z = 0.12;
      rightArmPivot.rotation.z = -0.12;
    }
  };

  return {
    group: root,
    updateAnimation,
    selectionRing,
    haloGlow,
    data: player,
  };
}
