import { Vector3D, vec3 } from "./math/vector3d";

export interface TeamBlackboard {
  possessionTeam: number;
  lastPasserId: number;
  lastReceiverId: number;
  lastPassPosition: Vector3D;

  formation: string;
  tactic: string;

  phase: string;

  ballPosition: Vector3D;
  ballVelocity: Vector3D;

  threatLevel: number;
  dangerLevel: number;

  opponentTeamId: number;
  opponentFormation: string;
  opponentTactic: string;

  shotsOnTarget: number;
  shotsOffTarget: number;
  tacklesWon: number;
  tacklesAttempted: number;
  passesAttempted: number;
  passesCompleted: number;
  foulsCommitted: number;
  foulsSuffered: number;
  yellowCards: number;
  redCards: number;
  cornersWon: number;
  cornersConceded: number;

  isSetPiece: boolean;
  setPieceType: string;

  recentEvents: string[];
}

export function createTeamBlackboard(): TeamBlackboard {
  return {
    possessionTeam: 0,
    lastPasserId: -1,
    lastReceiverId: -1,
    lastPassPosition: vec3(0, 0, 0),
    formation: "4-4-2",
    tactic: "Balanced",
    phase: "Possession",
    ballPosition: vec3(0, 0, 0),
    ballVelocity: vec3(0, 0, 0),
    threatLevel: 0,
    dangerLevel: 0,
    opponentTeamId: 0,
    opponentFormation: "4-4-2",
    opponentTactic: "Balanced",
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    tacklesWon: 0,
    tacklesAttempted: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    yellowCards: 0,
    redCards: 0,
    cornersWon: 0,
    cornersConceded: 0,
    isSetPiece: false,
    setPieceType: "",
    recentEvents: [],
  };
}

export interface PlayerBlackboard {
  ownId: number;
  ownTeamId: number;

  ownPosition: Vector3D;
  ownVelocity: Vector3D;
  ownFacing: Vector3D;

  hasBall: boolean;
  ballControlQuality: number;

  targetPosition: Vector3D;
  hasTargetPosition: boolean;

  currentAction: string;
  previousAction: string;

  defensivePressure: number;
  attackingThreat: number;

  teammateTrust: Map<number, number>;
  opponentThreat: Map<number, number>;

  recentDecisions: string[];
}

export function createPlayerBlackboard(): PlayerBlackboard {
  return {
    ownId: -1,
    ownTeamId: 0,
    ownPosition: vec3(0, 0, 0),
    ownVelocity: vec3(0, 0, 0),
    ownFacing: vec3(0, 1, 0),
    hasBall: false,
    ballControlQuality: 1,
    targetPosition: vec3(0, 0, 0),
    hasTargetPosition: false,
    currentAction: "Idle",
    previousAction: "Idle",
    defensivePressure: 0,
    attackingThreat: 0,
    teammateTrust: new Map(),
    opponentThreat: new Map(),
    recentDecisions: [],
  };
}