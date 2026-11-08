import { BallState, createBallState } from "./ball";
import { FieldState, createFieldState } from "./field";
import { GameEvent, GameEventType } from "./game-event";

export interface GameState {
  matchId: number;
  matchNumber: number;
  season: number;
  round: number;

  homeTeamId: number;
  awayTeamId: number;
  homeTeamScore: number;
  awayTeamScore: number;

  matchTime: number;
  addedTime: number;
  halfTime: number;

  ball: BallState;
  field: FieldState;

  homeTeamPlayers: number[];
  awayTeamPlayers: number[];

  events: GameEvent[];
}

export function createGameState(): GameState {
  return {
    matchId: -1,
    matchNumber: 0,
    season: 0,
    round: 0,
    homeTeamId: 0,
    awayTeamId: 0,
    homeTeamScore: 0,
    awayTeamScore: 0,
    matchTime: 0,
    addedTime: 0,
    halfTime: 0,
    ball: createBallState(),
    field: createFieldState(),
    homeTeamPlayers: [],
    awayTeamPlayers: [],
    events: [],
  };
}