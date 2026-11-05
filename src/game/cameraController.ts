import * as THREE from 'three';
import { CameraMode, PlayerData, BallState } from '../types/football';

export class FootballCameraController {
  private currentMode: CameraMode = 'BROADCAST';
  private targetPos = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private currentLook = new THREE.Vector3();

  constructor() {
    this.targetPos.set(0, 24, -42);
    this.lookTarget.set(0, 0, 0);
    this.currentLook.set(0, 0, 0);
  }

  public setMode(mode: CameraMode) {
    this.currentMode = mode;
  }

  public getMode(): CameraMode {
    return this.currentMode;
  }

  public cycleMode(): CameraMode {
    const modes: CameraMode[] = ['BROADCAST', 'ACTION', 'TACTICAL'];
    const nextIdx = (modes.indexOf(this.currentMode) + 1) % modes.length;
    this.currentMode = modes[nextIdx];
    return this.currentMode;
  }

  public update(
    camera: THREE.PerspectiveCamera,
    delta: number,
    controlledPlayer: PlayerData | undefined,
    ball: BallState
  ) {
    // Focus anchor: midpoint between controlled player and ball
    const focusX = controlledPlayer ? (controlledPlayer.x * 0.45 + ball.x * 0.55) : ball.x;
    const focusZ = controlledPlayer ? (controlledPlayer.z * 0.45 + ball.z * 0.55) : ball.z;

    const dt = Math.min(delta, 0.05);

    if (this.currentMode === 'BROADCAST') {
      // Dynamic TV Broadcast Sideline Camera
      // Clamped to field length so camera doesn't drift too far off ends
      const clampedX = Math.max(-28, Math.min(28, focusX * 0.72));
      const targetCamY = 22 + Math.abs(focusZ) * 0.12;
      const targetCamZ = -40 + focusZ * 0.2;

      this.targetPos.set(clampedX, targetCamY, targetCamZ);
      this.lookTarget.set(focusX, Math.min(ball.y * 0.3, 3), focusZ * 0.85);

      // Smooth damping
      camera.position.lerp(this.targetPos, 6.0 * dt);
      this.currentLook.lerp(this.lookTarget, 7.0 * dt);
      camera.lookAt(this.currentLook);
    } else if (this.currentMode === 'ACTION') {
      // Behind player third-person chase camera
      const p = controlledPlayer || { x: ball.x, z: ball.z, rotation: Math.PI / 2 };
      // Follow behind player rotation or attacking direction
      const behindDist = 14;
      const camHeight = 9.5;

      const camX = p.x - Math.sin(p.rotation) * behindDist;
      const camZ = p.z - Math.cos(p.rotation) * behindDist;

      this.targetPos.set(camX, camHeight, camZ);
      this.lookTarget.set(ball.x, Math.min(ball.y, 4), ball.z);

      camera.position.lerp(this.targetPos, 5.0 * dt);
      this.currentLook.lerp(this.lookTarget, 6.5 * dt);
      camera.lookAt(this.currentLook);
    } else {
      // TACTICAL Bird's Eye Drone Camera
      const clampedX = Math.max(-18, Math.min(18, focusX * 0.5));
      this.targetPos.set(clampedX, 48, -12);
      this.lookTarget.set(clampedX, 0, 4);

      camera.position.lerp(this.targetPos, 4.5 * dt);
      this.currentLook.lerp(this.lookTarget, 5.5 * dt);
      camera.lookAt(this.currentLook);
    }
  }
}

export const cameraController = new FootballCameraController();
