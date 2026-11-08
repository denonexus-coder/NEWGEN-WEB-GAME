import { Vector3D, vec3, vecDistance } from "../../core/math/vector3d";
import { PlayerState } from "../../core/types/player";
import { BallState } from "../../core/types/ball";
import { AIConfig } from "../../core/config";

export interface SpaceInfo {
  position: Vector3D;
  availableSpace: number;
  threatLevel: number;
  isDangerous: boolean;
}

export class SpacePerception {
  private spaces: SpaceInfo[] = [];

  update(
    players: PlayerState[],
    ballPosition: Vector3D,
    config: AIConfig
  ): void {
    this.spaces = [];

    // Analyze key areas of the pitch
    const areas = this.generateAnalysisAreas();

    for (const area of areas) {
      const spaceInfo = this.analyzeSpace(area, players, ballPosition, config);
      this.spaces.push(spaceInfo);
    }
  }

  getSpaces(): SpaceInfo[] {
    return this.spaces;
  }

  getOpenSpaces(radius: number): SpaceInfo[] {
    return this.spaces.filter(
      (space) =>
        space.availableSpace > radius && space.threatLevel < 50
    );
  }

  getDangerousSpaces(): SpaceInfo[] {
    return this.spaces.filter((space) => space.isDangerous);
  }

  getBestPassingOption(fromPosition: Vector3D, teammates: PlayerState[]): PlayerState | null {
    let bestPlayer: PlayerState | null = null;
    let bestScore = -Infinity;

    for (const teammate of teammates) {
      // Skip the player at fromPosition
      if (
        Math.abs(teammate.position.x - fromPosition.x) < 0.1 &&
        Math.abs(teammate.position.y - fromPosition.y) < 0.1
      ) {
        continue;
      }

      const score = this.calculatePassingScore(fromPosition, teammate);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = teammate;
      }
    }

    return bestPlayer;
  }

  private generateAnalysisAreas(): Vector3D[] {
    const areas: Vector3D[] = [];
    const fieldWidth = 100;
    const fieldHeight = 65;

    for (let x = 10; x <= fieldWidth - 10; x += 10) {
      for (let y = 10; y <= fieldHeight - 10; y += 10) {
        areas.push(vec3(x, y, 0));
      }
    }

    return areas;
  }

  private analyzeSpace(
    position: Vector3D,
    players: PlayerState[],
    ballPosition: Vector3D,
    config: AIConfig
  ): SpaceInfo {
    // Calculate available space around this position
    let nearestPlayerDist = Infinity;
    let threatLevel = 0;

    for (const player of players) {
      const dist = vecDistance(position, player.position);
      if (dist < nearestPlayerDist) {
        nearestPlayerDist = dist;
      }
      if (dist < config.dangerZoneRadius) {
        threatLevel += (1 - dist / config.dangerZoneRadius) * 100;
      }
    }

    const availableSpace = nearestPlayerDist;
    const isDangerous = threatLevel > 70;

    return {
      position,
      availableSpace,
      threatLevel: Math.min(100, threatLevel),
      isDangerous,
    };
  }

  private calculatePassingScore(fromPosition: Vector3D, teammate: PlayerState): number {
    const dist = vecDistance(fromPosition, teammate.position);
    const speed = Math.sqrt(
      teammate.velocity.x ** 2 + teammate.velocity.y ** 2
    );

    // Higher score for closer, faster teammates
    let score = 100 - dist;
    score += speed * 5;

    return score;
  }
}