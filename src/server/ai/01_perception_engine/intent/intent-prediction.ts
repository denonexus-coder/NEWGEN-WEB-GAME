import {
  Vector3D,
  vec3,
  vecAdd,
  vecScale,
  vecLength,
} from "../../core/math/vector3d";
import { PlayerState } from "../../core/types/player";
import { BallState, predictBallPosition } from "../../core/types/ball";
import { AIConfig } from "../../core/config";

export enum PlayerIntent {
  Pass = "PASS",
  Shoot = "SHOOT",
  Dribble = "DRIBBLE",
  Move = "MOVE",
  Defend = "DEFEND",
  Interact = "INTERCEPT",
  Clear = "CLEAR",
  Unknown = "UNKNOWN",
}

export interface PredictedIntent {
  playerId: number;
  intent: PlayerIntent;
  confidence: number;
  targetPosition: Vector3D;
  predictedTime: number;
}

export class IntentPrediction {
  private predictions: Map<number, PredictedIntent> = new Map();

  update(
    players: PlayerState[],
    ball: BallState,
    config: AIConfig
  ): void {
    this.predictions.clear();

    for (const player of players) {
      const prediction = this.predictIntent(player, ball, config);
      this.predictions.set(player.id, prediction);
    }
  }

  getPredictedIntent(playerId: number): PredictedIntent | null {
    return this.predictions.get(playerId) || null;
  }

  getAllPredictions(): PredictedIntent[] {
    return Array.from(this.predictions.values());
  }

  private predictIntent(
    player: PlayerState,
    ball: BallState,
    config: AIConfig
  ): PredictedIntent {
    const distToBall = vecLength(vecAdd(player.position, vec3(-ball.position.x, -ball.position.y, 0)));
    const isNearBall = distToBall < config.dangerZoneRadius;

    let intent: PlayerIntent;
    let confidence: number;

    if (isNearBall && player.hasBall) {
      // Player has ball - personality determines action
      if (player.personality.egoism > 70) {
        // Selfish player - prefer individual actions
        if (player.personality.creativity > 60) {
          intent = PlayerIntent.Dribble;
        } else if (player.technical.shooting > 60) {
          intent = PlayerIntent.Shoot;
        } else {
          intent = PlayerIntent.Dribble;
        }
        confidence = 0.7 + (player.personality.egoism - 70) * 0.003;
      } else if (player.personality.cooperation > 60) {
        // Cooperative player - prefer passing
        intent = PlayerIntent.Pass;
        confidence = 0.6 + (player.personality.cooperation - 60) * 0.004;
      } else {
        // Balanced player - consider multiple options
        if (player.personality.creativity > 50 && player.personality.courage > 50) {
          intent = PlayerIntent.Dribble;
        } else {
          intent = PlayerIntent.Pass;
        }
        confidence = 0.6;
      }
    } else if (isNearBall && !player.hasBall) {
      // Player near ball without possession
      // Personality influences whether they intercept or support
      if (player.personality.aggressiveness > 60 || player.personality.competitiveness > 70) {
        // Aggressive player - try to intercept
        intent = PlayerIntent.Interact;
        confidence = 0.5 + (player.personality.aggressiveness - 60) * 0.005;
      } else if (player.personality.cooperation > 60) {
        // Cooperative player - move to support
        intent = PlayerIntent.Move;
        confidence = 0.5 + (player.personality.cooperation - 60) * 0.005;
      } else {
        // Default - try to get ball
        intent = PlayerIntent.Interact;
        confidence = 0.5;
      }
    } else {
      // Player away from ball - movement based on role and personality
      if (player.personality.ambition > 70 && player.role !== "GK") {
        // Ambitious player - move forward
        intent = PlayerIntent.Move;
        confidence = 0.4;
      } else {
        intent = PlayerIntent.Move;
        confidence = 0.3;
      }
    }

    return {
      playerId: player.id,
      intent,
      confidence: Math.min(0.95, confidence),
      targetPosition: this.predictTargetPosition(player, intent, ball),
      predictedTime: config.predictionTimeHorizon,
    };
  }

  private predictTargetPosition(
    player: PlayerState,
    intent: PlayerIntent,
    ball: BallState
  ): Vector3D {
    switch (intent) {
      case PlayerIntent.Pass:
        return this.predictPassTarget(player, ball);
      case PlayerIntent.Shoot:
        return vec3(100, 32, 0); // Goal position
      case PlayerIntent.Dribble:
        return vecAdd(player.position, vecScale(player.velocity, 2));
      case PlayerIntent.Move:
        return vecAdd(player.position, vecScale(player.velocity, 1.5));
      case PlayerIntent.Interact:
        return ball.position;
      case PlayerIntent.Defend:
        return this.predictDefensivePosition(player, ball);
      default:
        return player.position;
    }
  }

  private predictPassTarget(player: PlayerState, ball: BallState): Vector3D {
    // Simplified - pass toward teammate or open space
    return ball.position;
  }

  private predictDefensivePosition(player: PlayerState, ball: BallState): Vector3D {
    // Move toward ball but maintain defensive shape
    return ball.position;
  }
}