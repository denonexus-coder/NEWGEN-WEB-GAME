import * as THREE from 'three';
import { BallState, TeamType } from '../types/football';
import { soundManager } from '../audio/soundManager';

export interface BallMeshAndPhysics {
  group: THREE.Group;
  ballMesh: THREE.Mesh;
  ballShadow: THREE.Mesh;
  state: BallState;
  update: (delta: number) => {
    goalScored: TeamType | null;
    outOfBounds: boolean;
  };
  kick: (vx: number, vy: number, vz: number, kickingTeam: TeamType, playerId: number) => void;
  reset: (x?: number, z?: number) => void;
}

// High-detail procedural football canvas texture
function createFootballTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 512);

  // Black pentagons & hexagons
  const drawPentagon = (cx: number, cy: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const drawHexagon = (cx: number, cy: number, r: number) => {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * 2 * Math.PI) / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  };

  // Center pentagon with blue lock cyan accents
  drawPentagon(256, 256, 45, '#090d16');
  drawPentagon(100, 120, 38, '#090d16');
  drawPentagon(412, 120, 38, '#090d16');
  drawPentagon(120, 390, 38, '#090d16');
  drawPentagon(392, 390, 38, '#090d16');

  // Hexagonal seam lines
  drawHexagon(256, 150, 42);
  drawHexagon(256, 362, 42);
  drawHexagon(150, 256, 42);
  drawHexagon(362, 256, 42);

  // High-contrast neon streaks
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 256, 75, 0.4, 2.2);
  ctx.stroke();

  ctx.strokeStyle = '#ff0055';
  ctx.beginPath();
  ctx.arc(256, 256, 75, 3.5, 5.3);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBall(): BallMeshAndPhysics {
  const group = new THREE.Group();
  group.name = 'Football';

  const radius = 0.38;
  const ballGeo = new THREE.SphereGeometry(radius, 24, 24);
  const ballTex = createFootballTexture();

  const ballMat = new THREE.MeshStandardMaterial({
    map: ballTex,
    roughness: 0.35,
    metalness: 0.15,
  });

  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  group.add(ballMesh);

  // Dynamic Contact Shadow
  const shadowGeo = new THREE.CircleGeometry(radius * 1.2, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
  ballShadow.rotation.x = -Math.PI / 2;
  ballShadow.position.y = 0.02;
  group.add(ballShadow);

  const state: BallState = {
    x: 0,
    y: radius,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    spinX: 0,
    spinZ: 0,
    radius,
    lastTouchedByTeam: null,
    lastTouchedPlayerId: null,
    isInNet: false,
  };

  const gravity = -20;
  const restitution = 0.62;
  const rollingFriction = 0.982;
  const airDrag = 0.994;

  const goalX = 50;
  const goalWidth = 14.6;
  const goalHeight = 4.8;
  const halfGoalW = goalWidth / 2;

  const kick = (vx: number, vy: number, vz: number, kickingTeam: TeamType, playerId: number) => {
    state.vx = vx;
    state.vy = vy;
    state.vz = vz;
    state.lastTouchedByTeam = kickingTeam;
    state.lastTouchedPlayerId = playerId;
    state.isInNet = false;
  };

  const reset = (x: number = 0, z: number = 0) => {
    state.x = x;
    state.y = radius;
    state.z = z;
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
    state.spinX = 0;
    state.spinZ = 0;
    state.isInNet = false;
  };

  let goalTriggered = false;

  const update = (delta: number) => {
    let goalScored: TeamType | null = null;
    let outOfBounds = false;

    // Time clamp to avoid physics explosion
    const dt = Math.min(delta, 0.05);

    // Apply gravity
    state.vy += gravity * dt;

    // Apply air drag
    state.vx *= Math.pow(airDrag, dt * 60);
    state.vz *= Math.pow(airDrag, dt * 60);

    // Integrate position
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    state.z += state.vz * dt;

    // Pitch Ground Collision
    if (state.y <= radius) {
      state.y = radius;
      if (state.vy < -0.8) {
        state.vy = -state.vy * restitution;
        // Bounce sound on hard landing
        if (Math.abs(state.vy) > 2.0) {
          soundManager.playKick(0.2);
        }
      } else {
        state.vy = 0;
      }

      // Rolling friction against grass
      state.vx *= Math.pow(rollingFriction, dt * 60);
      state.vz *= Math.pow(rollingFriction, dt * 60);
    }

    // Ball rotation based on velocity (realistic visual roll)
    const rollSpeedX = state.vz / radius;
    const rollSpeedZ = -state.vx / radius;
    ballMesh.rotation.x += rollSpeedX * dt;
    ballMesh.rotation.z += rollSpeedZ * dt;

    // Goal Post & Crossbar Collision check
    const checkPostHit = (px: number, pz: number) => {
      const dist = Math.hypot(state.x - px, state.z - pz);
      if (dist > 0.001 && dist < radius + 0.16 && state.y < goalHeight + 0.2) {
        // Bounce off post
        const nx = (state.x - px) / dist;
        const nz = (state.z - pz) / dist;
        const dot = state.vx * nx + state.vz * nz;
        state.vx = (state.vx - 2 * dot * nx) * 0.75;
        state.vz = (state.vz - 2 * dot * nz) * 0.75;
        state.x = px + nx * (radius + 0.18);
        state.z = pz + nz * (radius + 0.18);
        soundManager.playPostHit();
      }
    };

    // Left Goal Posts
    checkPostHit(-goalX, -halfGoalW);
    checkPostHit(-goalX, halfGoalW);
    // Right Goal Posts
    checkPostHit(goalX, -halfGoalW);
    checkPostHit(goalX, halfGoalW);

    // Crossbar collision
    if (
      Math.abs(state.x - (-goalX)) < radius + 0.2 ||
      Math.abs(state.x - goalX) < radius + 0.2
    ) {
      if (Math.abs(state.z) <= halfGoalW) {
        if (Math.abs(state.y - goalHeight) < radius + 0.18) {
          state.vy = -Math.abs(state.vy) * 0.7;
          state.vx = -state.vx * 0.7;
          state.y = goalHeight + radius + 0.1;
          soundManager.playPostHit();
        }
      }
    }

    // Net containment & Goal Detection
    // Left Goal (X < -goalX): If scored, NEWEGOISTS gets point
    if (state.x < -goalX && Math.abs(state.z) < halfGoalW && state.y < goalHeight) {
      state.isInNet = true;
      // Soft drag inside net
      state.vx *= 0.85;
      state.vz *= 0.85;
      if (state.x < -goalX - 3.2) {
        state.x = -goalX - 3.2;
        state.vx = 0;
      }
      if (!goalTriggered) {
        goalTriggered = true;
        goalScored = 'NEWEGOISTS';
        soundManager.playNetSound();
        soundManager.playGoalRoar();
      }
    }
    // Right Goal (X > goalX): If scored, NEWGEN gets point
    else if (state.x > goalX && Math.abs(state.z) < halfGoalW && state.y < goalHeight) {
      state.isInNet = true;
      state.vx *= 0.85;
      state.vz *= 0.85;
      if (state.x > goalX + 3.2) {
        state.x = goalX + 3.2;
        state.vx = 0;
      }
      if (!goalTriggered) {
        goalTriggered = true;
        goalScored = 'NEWGEN';
        soundManager.playNetSound();
        soundManager.playGoalRoar();
      }
    } else {
      goalTriggered = false;
    }

    // Out of bounds check (Touchlines and Goal lines outside the goal)
    const fieldW = 32;
    if (
      Math.abs(state.z) > fieldW + 2 ||
      (Math.abs(state.x) > goalX + 2 && !state.isInNet)
    ) {
      outOfBounds = true;
    }

    // Sync 3D Transforms
    ballMesh.position.set(state.x, state.y, state.z);
    ballShadow.position.set(state.x, 0.02, state.z);
    // Shadow fades and grows smaller when ball is airborne
    const heightFactor = Math.max(0, 1 - (state.y - radius) / 6);
    ballShadow.scale.setScalar(heightFactor);
    (ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * heightFactor;

    return {
      goalScored,
      outOfBounds,
    };
  };

  return {
    group,
    ballMesh,
    ballShadow,
    state,
    update,
    kick,
    reset,
  };
}
