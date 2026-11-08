import { Vector3D, vec3, vecLength } from "../math/vector3d";

export interface BallState {
  position: Vector3D;
  velocity: Vector3D;
  isInPlay: boolean;
  isStopped: boolean;
  isGoal: boolean;
  isOffside: boolean;
  possessionTeam: number;
  possessionPlayer: number;
  ballSpeed: number;
  ballHeight: number;
  ballAngle: number;
  events: string[];
}

export function createBallState(): BallState {
  return {
    position: vec3(0, 0, 0),
    velocity: vec3(0, 0, 0),
    isInPlay: true,
    isStopped: false,
    isGoal: false,
    isOffside: false,
    possessionTeam: 0,
    possessionPlayer: -1,
    ballSpeed: 0,
    ballHeight: 0,
    ballAngle: 0,
    events: [],
  };
}

export function getBallSpeed(ball: BallState): number {
  return vecLength(ball.velocity);
}

export function isBallMoving(ball: BallState): boolean {
  return getBallSpeed(ball) > 0.001;
}

export function predictBallPosition(ball: BallState, time: number): Vector3D {
  return {
    x: ball.position.x + ball.velocity.x * time,
    y: ball.position.y + ball.velocity.y * time,
    z: ball.position.z + ball.velocity.z * time,
  };
}