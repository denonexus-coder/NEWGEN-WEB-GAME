import {
  Vector3D,
  vec3,
  vecAdd,
  vecSub,
  vecScale,
  vecLength,
  vecNormalize,
  vecDistance,
} from "../../core/math/vector3d";
import { BallState, predictBallPosition, getBallSpeed } from "../../core/types/ball";
import { AIConfig } from "../../core/config";

export class BallPerception {
  private ballPosition: Vector3D = vec3();
  private ballVelocity: Vector3D = vec3();
  private ballDirection: Vector3D = vec3();
  private distanceToBall: number = 0;
  private ballSpeed: number = 0;
  private interceptionPoint: Vector3D = vec3();
  private ballInPossession: boolean = false;

  update(ball: BallState, config: AIConfig): void {
    this.ballPosition = ball.position;
    this.ballVelocity = ball.velocity;
    this.ballSpeed = getBallSpeed(ball);
    this.ballDirection = vecNormalize(ball.velocity);
    this.ballInPossession = ball.possessionPlayer !== -1;
  }

  getBallPosition(): Vector3D {
    return this.ballPosition;
  }

  getBallVelocity(): Vector3D {
    return this.ballVelocity;
  }

  predictPosition(time: number): Vector3D {
    return predictBallPosition(
      {
        position: this.ballPosition,
        velocity: this.ballVelocity,
        isInPlay: true,
        isStopped: false,
        isGoal: false,
        isOffside: false,
        possessionTeam: 0,
        possessionPlayer: -1,
        ballSpeed: this.ballSpeed,
        ballHeight: 0,
        ballAngle: 0,
        events: [],
      },
      time
    );
  }

  getDistance(): number {
    return this.distanceToBall;
  }

  getBallSpeed(): number {
    return this.ballSpeed;
  }

  getInterceptionPoint(time: number): Vector3D {
    return predictBallPosition(
      {
        position: this.ballPosition,
        velocity: this.ballVelocity,
        isInPlay: true,
        isStopped: false,
        isGoal: false,
        isOffside: false,
        possessionTeam: 0,
        possessionPlayer: -1,
        ballSpeed: this.ballSpeed,
        ballHeight: 0,
        ballAngle: 0,
        events: [],
      },
      time
    );
  }

  isBallInPossession(): boolean {
    return this.ballInPossession;
  }

  getTimeToReachBall(playerSpeed: number): number {
    if (playerSpeed < 0.001) return Infinity;
    return this.distanceToBall / playerSpeed;
  }

  getBallDirection(): Vector3D {
    return this.ballDirection;
  }

  isBallMoving(): boolean {
    return this.ballSpeed > 0.001;
  }

  getTrajectory(timeStep: number, steps: number): Vector3D[] {
    const trajectory: Vector3D[] = [];
    for (let i = 0; i < steps; i++) {
      trajectory.push(this.predictPosition(i * timeStep));
    }
    return trajectory;
  }
}