/**
 * PROTOCOLO server ↔ client — CONTRATO CONGELADO (v1)
 *
 * - O SERVER (Web Worker) é dono destes tipos: mudanças fazem-se aqui e o
 *   client adapta-se.
 * - O client só consome snapshots/events/stats e envia commands.
 * - Tudo roda offline (postMessage em processo, zero rede).
 *
 * Serialização: Float32Array TRANSFERIDO (zero cópia por tick).
 */

export const PROTOCOL_VERSION = 1;

/** 22 jogadores: x, y, z, yaw, stamina, hasBall */
export const PLAYER_STRIDE = 6;
export const TEAM_SIZE = 11;
export const PLAYER_COUNT = TEAM_SIZE * 2; // 0..10 = casa, 11..21 = fora

/** Bola: x, y, z, vx, vy, vz */
export const BALL_FLOATS = 6;

/** Lógica do server (tick fixo) */
export const LOGIC_DT = 0.05; // 20 TPS
export const TICK_MS = 50; // cadência do scheduler no worker

// ==================== server → client ====================

export interface Snapshot {
  /** monotónico — o client descarta snapshots antigos */
  seq: number;
  tick: number;
  /** segundos de jogo (0..5400 para 90') */
  gameTime: number;
  /** PLAYER_COUNT × PLAYER_STRIDE */
  players: Float32Array;
  /** BALL_FLOATS — velocidade a zeros quando a bola está com um jogador */
  ball: Float32Array;
  scoreHome: number;
  scoreAway: number;
  /** equipa com posse (1 = casa, 2 = fora) */
  possession: 1 | 2;
  /** true = bola no ar (remate/passe a caminho) */
  ballInFlight: boolean;
}

export interface SideStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  shotsBlocked: number;
  saves: number;
  passesAttempted: number;
  passesCompleted: number;
  possessionTicks: number;
  dribblesWon: number;
  tacklesWon: number;
  interceptions: number;
  skillMoves: number;
}

/** enviada ~1×/s */
export interface MatchStats {
  gameTime: number;
  home: SideStats;
  away: SideStats;
}

export type GameEventType =
  | "goal"
  | "shot"
  | "save"
  | "kickoff"
  | "halftime"
  | "fulltime";

export interface GameEvent {
  t: number;
  type: GameEventType;
  team?: 1 | 2;
  outcome?: "goal" | "save" | "miss" | "blocked";
  player?: string;
  scoreHome?: number;
  scoreAway?: number;
}

export interface TeamInfo {
  id: number;
  name: string;
  short: string;
  style: string;
  formation: string;
  /** [gk, def, mid, fwd] — para o client colorir/posicionar */
  colors: [string, string, string, string];
}

export interface MatchSummary {
  homeId: number;
  awayId: number;
  homeGoals: number;
  awayGoals: number;
  ticks: number;
  goalLog: string[];
}

export type MsgOut =
  | { kind: "ready"; protocol: number; teams: TeamInfo[] }
  | { kind: "snapshot"; snap: Snapshot }
  | { kind: "stats"; stats: MatchStats }
  | { kind: "events"; events: GameEvent[] }
  | { kind: "done"; summary: MatchSummary }
  | { kind: "pong"; t: number }
  | { kind: "error"; message: string };

// ==================== client → server ====================

export interface InitCommand {
  type: "init";
  seed: number;
  homeId: number;
  awayId: number;
  /** minutos de jogo (90 = partida completa) */
  minutes: number;
  /** 1 = tempo real; 2/4 = acelerado; 1000 = MAX (modo rápido) */
  timeScale: number;
  /** false = sem física (só lógica pura) */
  physics: boolean;
}

export type Command =
  | InitCommand
  | { type: "pause" }
  | { type: "resume" }
  | { type: "speed"; timeScale: number }
  | { type: "tactic"; teamId: 1 | 2; mode: "balanced" | "attack" | "defend" }
  | { type: "substitute"; teamId: 1 | 2; out: number; in: number };

export type MsgIn =
  | { kind: "command"; cmd: Command }
  | { kind: "ping"; t: number };
