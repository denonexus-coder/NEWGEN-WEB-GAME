import {
  Vector3D,
  vec3,
  vecDistance,
} from "../../core/math/vector3d";
import { PlayerState } from "../../core/types/player";
import { BallState } from "../../core/types/ball";
import { AIConfig } from "../../core/config";

export enum PerceptionResult {
  Success = "SUCCESS",
  InsufficientData = "INSUFFICIENT_DATA",
  TargetOutOfRange = "TARGET_OUT_OF_RANGE",
}

export interface PerceivedPlayer {
  playerId: number;
  state: PlayerState;
  lastKnownPosition: Vector3D;
  lastKnownVelocity: Vector3D;
  confidence: number;
  result: PerceptionResult;
}

export class PlayerPerception {
  private perceivedPlayers: Map<number, PerceivedPlayer> = new Map();
  private teammateIds: number[] = [];
  private opponentIds: number[] = [];

  updateTeam(teamPlayers: PlayerState[], config: AIConfig): void {
    this.perceivedPlayers.clear();
    this.teammateIds = [];
    this.opponentIds = [];

    for (const player of teamPlayers) {
      const perceived: PerceivedPlayer = {
        playerId: player.id,
        state: player,
        lastKnownPosition: player.position,
        lastKnownVelocity: player.velocity,
        confidence: 1.0,
        result: PerceptionResult.Success,
      };
      this.perceivedPlayers.set(player.id, perceived);

      if (player.teamId === teamPlayers[0]?.teamId) {
        this.teammateIds.push(player.id);
      } else {
        this.opponentIds.push(player.id);
      }
    }
  }

  getPlayer(playerId: number): PerceivedPlayer {
    const result = this.perceivedPlayers.get(playerId);
    if (result) {
      return result;
    }
    return {
      playerId,
      state: {} as PlayerState,
      lastKnownPosition: vec3(),
      lastKnownVelocity: vec3(),
      confidence: 0,
      result: PerceptionResult.InsufficientData,
    };
  }

  getPerceivedTeammates(radius: number): number[] {
    return this.teammateIds.filter((id) => {
      const player = this.getPlayer(id);
      return vecDistance(player.lastKnownPosition, this.getBallPosition()) < radius;
    });
  }

  getPerceivedOpponents(radius: number): number[] {
    return this.opponentIds.filter((id) => {
      const player = this.getPlayer(id);
      return vecDistance(player.lastKnownPosition, this.getBallPosition()) < radius;
    });
  }

  getTeammatePositions(radius: number): Vector3D[] {
    return this.getPerceivedTeammates(radius).map((id) =>
      this.getPlayer(id).lastKnownPosition
    );
  }

  getOpponentPositions(radius: number): Vector3D[] {
    return this.getPerceivedOpponents(radius).map((id) =>
      this.getPlayer(id).lastKnownPosition
    );
  }

  getNearestPerceivedPlayer(): number {
    let nearestId = -1;
    let nearestDist = Infinity;

    for (const id of [...this.teammateIds, ...this.opponentIds]) {
      const player = this.getPlayer(id);
      const dist = vecDistance(player.lastKnownPosition, this.getBallPosition());
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }
    return nearestId;
  }

  getSpatialRelation(playerId: number, ball: BallState): Vector3D {
    const player = this.getPlayer(playerId);
    return vec3(
      player.lastKnownPosition.x - ball.position.x,
      player.lastKnownPosition.y - ball.position.y,
      0
    );
  }

  getPassingLanes(radius: number): Array<[number, number]> {
    const lanes: Array<[number, number]> = [];
    const teammates = this.getPerceivedTeammates(radius);

    for (let i = 0; i < teammates.length; i++) {
      for (let j = i + 1; j < teammates.length; j++) {
        lanes.push([teammates[i], teammates[j]]);
      }
    }
    return lanes;
  }

  private getBallPosition(): Vector3D {
    // This would be injected in real implementation
    return vec3(50, 32, 0);
  }
}