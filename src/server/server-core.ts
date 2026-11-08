/**
 * GameServer — núcleo lógico do servidor Football AI.
 *
 * - Corre o simulador (12 engines + física opcional) em tick fixo.
 * - Produz Snapshot (Float32Array), MatchStats (~1×/s) e GameEvent[].
 * - RNG stubado com seed → determinismo total (dois servers iguais = mesmos resultados).
 * - Zero DOM/three → corre no Web Worker (browser) e em Node (testes/CLI).
 *
 * O client nunca edita este contrato: ver src/shared/protocol.ts.
 */
import {
  createEngineBundle,
  MatchSimulator,
  type MatchResult,
  type TeamMatchStats,
  type TickState,
} from "./sim/simulation";
import { buildTeam, createTournamentTeams, type TeamProfile } from "./sim/teams";
import { BallPhysics } from "./physics/ball-physics";
import {
  BALL_FLOATS,
  PLAYER_COUNT,
  PLAYER_STRIDE,
  type GameEvent,
  type MatchStats,
  type MatchSummary,
  type SideStats,
  type Snapshot,
  type TeamInfo,
} from "../shared/protocol";

// ---------------------------------------------------------------- RNG seed

/** PRNG determinístico (mulberry32) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- paletas

/** [equipa, secundária, GR, destaque] por id de perfil */
const PALETTES: Record<number, [string, string, string, string]> = {
  1: ["#3f4756", "#8b98ab", "#f4a300", "#cdd5e0"], // Atlético Robô
  2: ["#7c3aed", "#312e81", "#22d3ee", "#f0abfc"], // FC Criatividade
  3: ["#b91c1c", "#450a0a", "#fbbf24", "#fecaca"], // União dos Brutos
  4: ["#0f766e", "#134e4a", "#f8fafc", "#99f6e4"], // Real Equilíbrio
  5: ["#1d4ed8", "#1e3a8a", "#fde047", "#bfdbfe"], // Contragolpe FC
  6: ["#a16207", "#422006", "#e7e5e4", "#fef3c7"], // Veteranos FC
};

// ---------------------------------------------------------------- opções

export interface GameServerOptions {
  seed: number;
  homeId: number; // perfil 1..6
  awayId: number; // perfil 1..6
  minutes?: number; // default 90
  dt?: number; // default LOGIC_DT (0.05)
  physics?: boolean; // default true
}

export interface StepResult {
  /** último snapshot do lote (null se nenhum tick avançou) */
  snapshot: Snapshot | null;
  events: GameEvent[];
  stats: MatchStats | null;
  done: boolean;
  result: MatchResult | null;
}

// ---------------------------------------------------------------- servidor

export class GameServer {
  readonly homeId: number;
  readonly awayId: number;
  readonly minutes: number;
  readonly dt: number;
  readonly usePhysics: boolean;
  readonly seed: number;

  private it: Generator<TickState, MatchResult, void> | null = null;
  private result: MatchResult | null = null;
  private lastTick: TickState | null = null;
  private seq = 0;
  private ticksDone = 0;
  private statsEvery: number;
  private rng: () => number = Math.random;
  private savedRandom: (() => number) | null = null;
  private profiles: TeamProfile[] = [];
  private started = false;

  constructor(opts: GameServerOptions) {
    this.seed = opts.seed >>> 0;
    this.homeId = opts.homeId;
    this.awayId = opts.awayId;
    this.minutes = opts.minutes ?? 90;
    this.dt = opts.dt ?? 0.05;
    this.usePhysics = opts.physics !== false;
    // stats a cada ~1s de jogo
    this.statsEvery = Math.max(1, Math.round(1 / this.dt));
  }

  /** Info das equipas para o handshake (pode chamar-se antes de start) */
  getTeams(): TeamInfo[] {
    const all = this.profiles.length ? this.profiles : createTournamentTeams();
    return [this.homeId, this.awayId].map((id) => {
      const p = all.find((t) => t.id === id) ?? all[0];
      return {
        id: p.id,
        name: p.name,
        short: p.short,
        style: p.style,
        formation: p.formation.name,
        colors: PALETTES[p.id] ?? PALETTES[1],
      };
    });
  }

  /** Cria equipas/engines e o gerador da partida (instala RNG com seed) */
  start(): void {
    if (this.started) return;
    this.started = true;

    // RNG global stubado — o simulador usa Math.random() por todo o lado.
    // Em worker dedicado isto é seguro; em Node os testes chamam dispose().
    this.savedRandom = Math.random;
    this.rng = mulberry32(this.seed);
    Math.random = this.rng;

    this.profiles = createTournamentTeams();
    const homeProfile = this.profiles.find((p) => p.id === this.homeId) ?? this.profiles[0];
    const awayProfile = this.profiles.find((p) => p.id === this.awayId) ?? this.profiles[1];
    const home = buildTeam(homeProfile, this.rng);
    const away = buildTeam(awayProfile, this.rng);

    const engines = createEngineBundle();
    const physics = this.usePhysics ? new BallPhysics() : undefined;
    const sim = new MatchSimulator(engines, physics);
    this.it = sim.runMatch(home, away, this.minutes, this.dt);
  }

  /**
   * Avança até `maxTicks` ticks. Devolve o último snapshot + eventos/stats
   * acumulados do lote. Quando a partida termina, done=true.
   */
  step(maxTicks: number): StepResult {
    if (!this.it) {
      // já terminou (ou nunca começou)
      return {
        snapshot: null,
        events: [],
        stats: this.lastTick ? this.buildStats(this.lastTick) : null,
        done: this.result !== null,
        result: this.result,
      };
    }

    const events: GameEvent[] = [];
    let stats: MatchStats | null = null;
    let last: TickState | null = null;

    for (let i = 0; i < maxTicks; i++) {
      const r = this.it.next();
      if (r.done) {
        this.result = r.value as MatchResult;
        this.it = null;
        break;
      }
      const t = r.value as TickState;
      last = t;
      this.lastTick = t;
      this.ticksDone++;
      if (t.events.length > 0) {
        for (const ev of t.events) events.push(ev);
      }
      if (this.ticksDone % this.statsEvery === 0) {
        stats = this.buildStats(t);
      }
    }

    const done = this.result !== null;
    if (done) stats = this.buildStats(this.lastTick!);

    return {
      snapshot: last ? this.buildSnapshot(last) : null,
      events,
      stats,
      done,
      result: this.result,
    };
  }

  getSummary(): MatchSummary | null {
    if (!this.result) return null;
    const r = this.result;
    return {
      homeId: r.homeId,
      awayId: r.awayId,
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
      ticks: r.ticks,
      goalLog: r.goalLog,
    };
  }

  /** Repõe o Math.random global e liberta referências */
  dispose(): void {
    if (this.savedRandom) {
      Math.random = this.savedRandom;
      this.savedRandom = null;
    }
    this.it = null;
  }

  // ------------------------------------------------------------- privado

  private buildSnapshot(t: TickState): Snapshot {
    const players = new Float32Array(PLAYER_COUNT * PLAYER_STRIDE);
    let idx = 0;
    for (const list of [t.home, t.away]) {
      const n = Math.min(list.length, 11);
      for (let i = 0; i < n && idx < PLAYER_COUNT; i++, idx++) {
        const p = list[i];
        const b = idx * PLAYER_STRIDE;
        players[b] = p.position.x;
        players[b + 1] = p.position.y;
        players[b + 2] = p.position.z;
        // yaw: direção do movimento (estável: só atualiza se andou)
        const yaw = this.yawFor(idx, p.position.x, p.position.y, p.facingDirection);
        players[b + 3] = yaw;
        players[b + 4] = p.stamina;
        players[b + 5] = p.hasBall ? 1 : 0;
      }
    }
    // zeros para slots vazios (defensivo)
    for (; idx < PLAYER_COUNT; idx++) {
      // já estão a zero
    }

    const ball = new Float32Array(BALL_FLOATS);
    ball[0] = t.ball.position.x;
    ball[1] = t.ball.position.y;
    ball[2] = t.ball.position.z;
    if (t.ballInFlight) {
      ball[3] = t.ball.velocity.x;
      ball[4] = t.ball.velocity.y;
      ball[5] = t.ball.velocity.z;
    }

    this.seq++;
    return {
      seq: this.seq,
      tick: t.ticks,
      gameTime: t.time,
      players,
      ball,
      scoreHome: t.scoreHome,
      scoreAway: t.scoreAway,
      possession: t.possession,
      ballInFlight: t.ballInFlight,
    };
  }

  /** histórico de posição por slot para derivar yaw */
  private prevX = new Float32Array(PLAYER_COUNT).fill(-1);
  private prevY = new Float32Array(PLAYER_COUNT).fill(-1);
  private yaw = new Float32Array(PLAYER_COUNT);

  private yawFor(idx: number, x: number, y: number, facing: { x: number; y: number }): number {
    const dx = x - this.prevX[idx];
    const dy = y - this.prevY[idx];
    if (Math.hypot(dx, dy) > 0.01) {
      this.yaw[idx] = Math.atan2(dy, dx);
    } else if (this.prevX[idx] < 0 && Math.hypot(facing.x, facing.y) > 0.01) {
      this.yaw[idx] = Math.atan2(facing.y, facing.x);
    }
    this.prevX[idx] = x;
    this.prevY[idx] = y;
    return this.yaw[idx];
  }

  private buildStats(t: TickState): MatchStats {
    return {
      gameTime: t.time,
      home: sideStats(t.homeStats),
      away: sideStats(t.awayStats),
    };
  }
}

function sideStats(s: TeamMatchStats): SideStats {
  return {
    goals: s.goals,
    shots: s.shots,
    shotsOnTarget: s.shotsOnTarget,
    shotsBlocked: s.shotsBlocked,
    saves: s.saves,
    passesAttempted: s.passesAttempted,
    passesCompleted: s.passesCompleted,
    possessionTicks: s.possessionTicks,
    dribblesWon: s.dribblesWon,
    tacklesWon: s.tacklesWon,
    interceptions: s.interceptions,
    skillMoves: s.skillMoves,
  };
}
