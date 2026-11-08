import { Vector3D } from "../math/vector3d";

export enum GameEventType {
  Goal = "GOAL",
  Foul = "FOUL",
  YellowCard = "YELLOW_CARD",
  RedCard = "RED_CARD",
  Substitution = "SUBSTITUTION",
  CornerKick = "CORNER_KICK",
  FreeKick = "FREE_KICK",
  ThrowIn = "THROW_IN",
  Kickoff = "KICKOFF",
  PassComplete = "PASS_COMPLETE",
  PassIncomplete = "PASS_INCOMPLETE",
  ShotOnTarget = "SHOT_ON_TARGET",
  ShotOffTarget = "SHOT_OFF_TARGET",
  TackleWon = "TACKLE_WON",
  TackleLost = "TACKLE_LOST",
  Interception = "INTERCEPTION",
  DribbleWon = "DRIBBLE_WON",
  DribbleLost = "DRIBBLE_LOST",
  Saving = "SAVING",
  PenaltyKick = "PENALTY_KICK",
  DirectFreeKick = "DIRECT_FREE_KICK",
  IndirectFreeKick = "INDIRECT_FREE_KICK",
}

export interface GameEvent {
  type: GameEventType;
  playerId: number;
  targetPlayerId: number;
  position: Vector3D;
  time: number;
  details: string;
}

export function createGameEvent(
  type: GameEventType,
  playerId: number,
  targetPlayerId: number,
  position: Vector3D,
  time: number,
  details: string
): GameEvent {
  return {
    type,
    playerId,
    targetPlayerId,
    position,
    time,
    details,
  };
}