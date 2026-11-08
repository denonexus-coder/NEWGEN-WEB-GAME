import {
  Vector3D,
  vec3,
  vecDistance,
} from "../../core/math/vector3d";
import { PlayerState } from "../../core/types/player";
import { AIConfig } from "../../core/config";

export class OpponentPerception {
  private opponentThreats: Array<[number, number]> = [];
  private opponentHistory: Map<number, number[]> = new Map();
  private opponentsMap: Map<number, PlayerState> = new Map();

  update(opponents: PlayerState[], config: AIConfig): void {
    this.opponentThreats = [];
    this.opponentHistory.clear();
    this.opponentsMap.clear();

    for (const opponent of opponents) {
      this.opponentsMap.set(opponent.id, opponent);
      const threat = this.calculateThreat(opponent);
      this.opponentThreats.push([opponent.id, threat]);
    }
  }

  getThreatLevel(opponentId: number): number {
    const threat = this.opponentThreats.find(([id]) => id === opponentId);
    return threat ? threat[1] : 50;
  }

  getDangerToBall(ballPosition: Vector3D, ballVelocity: Vector3D): number {
    let maxDanger = 0;
    for (const [opponentId, threat] of this.opponentThreats) {
      const opponent = this.getOpponent(opponentId);
      if (opponent) {
        const distToBall = vecDistance(opponent.position, ballPosition);
        const danger = threat * Math.max(0, 1 - distToBall / 30);
        maxDanger = Math.max(maxDanger, danger);
      }
    }
    return maxDanger;
  }

  getLikelyMovementDirection(opponentId: number): Vector3D {
    const opponent = this.getOpponent(opponentId);
    if (!opponent) return vec3(0, 1, 0);
    return opponent.velocity;
  }

  predictPosition(opponentId: number, time: number): Vector3D {
    const opponent = this.getOpponent(opponentId);
    if (!opponent) return vec3();
    return {
      x: opponent.position.x + opponent.velocity.x * time,
      y: opponent.position.y + opponent.velocity.y * time,
      z: opponent.position.z + opponent.velocity.z * time,
    };
  }

  getDefensiveBehavior(opponentId: number): number {
    const history = this.opponentHistory.get(opponentId);
    if (!history || history.length === 0) return 0.5;
    return history.reduce((sum, val) => sum + val, 0) / history.length;
  }

  getAggression(opponentId: number): number {
    const opponent = this.getOpponent(opponentId);
    if (!opponent) return 50;
    return opponent.personality.aggressiveness;
  }

  getSpeed(opponentId: number): number {
    const opponent = this.getOpponent(opponentId);
    if (!opponent) return 0;
    return Math.sqrt(
      opponent.velocity.x ** 2 + opponent.velocity.y ** 2 + opponent.velocity.z ** 2
    );
  }

  private calculateThreat(opponent: PlayerState): number {
    let threat = 0;

    // Personality influence (0-30 points)
    threat += opponent.personality.aggressiveness * 0.15;
    threat += opponent.personality.competitiveness * 0.15;

    // Technical influence (0-30 points)
    threat += opponent.technical.dribbling * 0.1;
    threat += opponent.technical.shooting * 0.1;
    threat += opponent.technical.passing * 0.1;

    // Physical influence (0-25 points)
    threat += opponent.physical.pace * 0.08;
    threat += opponent.physical.acceleration * 0.08;
    threat += opponent.physical.agility * 0.09;

    // Mental influence (0-15 points)
    threat += opponent.mental.composure * 0.05;
    threat += opponent.mental.anticipation * 0.05;
    threat += opponent.mental.decisions * 0.05;

    return Math.min(100, Math.max(0, threat));
  }

  private getOpponent(opponentId: number): PlayerState | null {
    return this.opponentsMap.get(opponentId) || null;
  }
}